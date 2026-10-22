/* Pure calculation rules; internal quantities remain in liters. */
(function(root){
  "use strict";
  const sources={
    snis:{name:"MDR / SNIS",title:"Diagnóstico de abastecimento de água — dados de 2020",url:"https://www.gov.br/mdr/pt-br/noticias/mdr-lanca-diagnostico-sobre-servicos-publicos-de-abastecimento-de-agua",date:"24/05/2022",accessed:"13/10/2026",note:"Média nacional histórica de 152,1 L/habitante/dia (2020). Indicador agregado; não é média atual de Sorocaba nem recomendação individual de consumo."},
    saae:{name:"SAAE Ambiental de Santa Fé do Sul",title:"Dicas de Economia",url:"https://saaeambientalsantafe.sp.gov.br/meio-ambiente/dicas-de-economia",date:"Sem data informada",accessed:"13/10/2026",note:"Cenários educativos de equipamento e uso; não são médias universais."},
    camara:{name:"Câmara dos Deputados / EcoCâmara",title:"Como economizar água em nossa rotina diária",url:"https://www2.camara.leg.br/a-camara/estruturaadm/gestao-na-camara-dos-deputados/responsabilidade-social-e-ambiental/ecocamara/noticias/Comoeconomizaragua.html",date:"Sem data informada",accessed:"13/10/2026",note:"Publicação atribui os exemplos à Sabesp. Valores dependem das condições de uso."},
    user:{name:"Usuário",title:"Hipótese personalizada",url:null,date:"Informada na configuração",accessed:null,note:"Valor declarado, sem validação externa. Não é uma média oficial."}
  };
  const activities=[
    {id:"shower-electric",name:"Banho — chuveiro elétrico",liters:45,minutes:15,perPerson:true,source:"saae",conditions:"Registro parcialmente aberto, banho de 15 min."},
    {id:"shower",name:"Banho — ducha",liters:135,minutes:15,perPerson:true,source:"saae",conditions:"Ducha com registro parcialmente aberto durante 15 min."},
    {id:"dishes",name:"Louça — torneira aberta",liters:117,minutes:15,perPerson:false,source:"saae",conditions:"Casa; torneira parcialmente aberta durante 15 min."},
    {id:"dishes-basin",name:"Louça — lavagem em cuba",liters:20,minutes:null,perPerson:false,source:"camara",conditions:"Lavagem em cuba cheia; valor por ocorrência."},
    {id:"laundry",name:"Roupas — máquina de 5 kg",liters:135,minutes:null,perPerson:false,source:"saae",conditions:"Exemplo de máquina com capacidade de 5 kg, por ciclo. Consulte o modelo real."},
    {id:"garden",name:"Rega — mangueira",liters:186,minutes:10,perPerson:false,source:"camara",conditions:"Mangueira aberta por 10 min."},
    {id:"car",name:"Carro — baldes",liters:40,minutes:null,perPerson:false,source:"camara",conditions:"Exemplo de lavagem com baldes, por ocorrência."},
    {id:"sidewalk",name:"Calçada — mangueira",liters:279,minutes:15,perPerson:false,source:"saae",conditions:"Mangueira usada durante 15 min."},
    {id:"pool",name:"Encher piscina",liters:null,minutes:null,perPerson:false,source:"user",conditions:"Informe o volume a preencher; depende das dimensões e do nível inicial."},
    {id:"cleaning",name:"Limpeza da casa",liters:null,minutes:null,perPerson:false,source:"user",conditions:"Informe o volume por ocorrência; não há valor universal adotado."}
  ];
  const defaults={residents:null,referenceMode:"snis",referenceLiters:152.1,tolerance:10,scope:"branches",ramal1:"Ramal 01",ramal2:"Ramal 02"};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function profile(input){
    const p={...defaults,...input};
    if(!Number.isInteger(p.residents)||p.residents<1||p.residents>100) throw new Error("Informe de 1 a 100 moradores, sem casas decimais.");
    if(!["snis","user"].includes(p.referenceMode)) throw new Error("Referência inválida.");
    if(p.referenceMode==="snis") p.referenceLiters=152.1;
    if(!Number.isFinite(p.referenceLiters)||p.referenceLiters<=0||p.referenceLiters>10000) throw new Error("A referência deve ser maior que zero e até 10 m³/pessoa/dia.");
    if(!Number.isFinite(p.tolerance)||p.tolerance<0||p.tolerance>50) throw new Error("Informe tolerância entre 0 e 50%.");
    if(!["branches","whole"].includes(p.scope)) throw new Error("Abrangência inválida.");
    for(const k of ["ramal1","ramal2"]){p[k]=String(p[k]||defaults[k]).trim();if(!p[k]||p[k].length>32)throw new Error("O nome de cada ramal deve ter até 32 caracteres.");}
    return p;
  }
  function maybeProfile(input){try{return profile(input);}catch{return null;}}
  function m3(liters){
    if(!Number.isFinite(liters)||liters<0)return "—";
    const n=liters/1000;
    if(n>0 && n<0.000001)return "< 0,000001 m³";
    return n.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:6})+" m³";
  }
  function classify(actual,expected,tolerance=10,{complete=false,comparable=true}={}){
    if(!comparable || !Number.isFinite(actual)||actual<0||!Number.isFinite(expected)||expected<=0) return {code:"unknown",label:"Dados insuficientes para comparar"};
    const low=expected*(1-tolerance/100),high=expected*(1+tolerance/100),epsilon=Math.max(1,expected)*1e-10;
    if(actual>high+epsilon)return {code:"above",label:complete?"Acima da faixa de referência":"Faixa diária já ultrapassada",percent:(actual/expected-1)*100};
    if(!complete)return {code:"partial",label:"Coleta parcial — sem classificação final"};
    if(actual<low-epsilon)return {code:"below",label:"Abaixo da faixa de referência",percent:(actual/expected-1)*100};
    return {code:"within",label:"Dentro da faixa de referência",percent:(actual/expected-1)*100};
  }
  function estimate(id,{residents,quantity=1,minutes,customLiters}={}){
    const a=activities.find(x=>x.id===id);if(!a)throw new Error("Atividade inválida.");
    const maxQuantity=a.id==="shower"||a.id==="shower-electric"?5:a.id==="pool"?10:20;
    if(!Number.isInteger(quantity)||quantity<1||quantity>maxQuantity)throw new Error("Informe de 1 a "+maxQuantity+" ocorrência(s) para esta atividade.");
    if(a.perPerson&&(!Number.isInteger(residents)||residents<1||residents>100))throw new Error("Configure a quantidade de moradores.");
    let unit=a.liters;
    if(unit===null){
      const maxCustom=a.id==="pool"?100000:a.id==="cleaning"?10000:100000;
      if(!Number.isFinite(customLiters)||customLiters<=0||customLiters>maxCustom)throw new Error("O volume por ocorrência deve ser maior que zero e até "+(maxCustom/1000).toLocaleString("pt-BR")+" m³ para esta atividade.");
      unit=customLiters;
    }
    if(a.minutes){
      const maxMinutes=a.id==="shower"||a.id==="shower-electric"?60:a.id==="dishes"?60:a.id==="garden"?60:a.id==="sidewalk"?60:120;
      if(!Number.isFinite(minutes)||minutes<=0||minutes>maxMinutes)throw new Error("Informe uma duração entre 0 e "+maxMinutes+" minutos para esta atividade.");
      unit*=minutes/a.minutes;
    }
    return unit*quantity*(a.perPerson?residents:1);
  }
  function dayProfile(day,current){return day&&day.profile?maybeProfile(day.profile):maybeProfile(current);}
  function compareDay(day,current,{closed=false,connected=true}={}){
    const p=dayProfile(day,current),has=day&&day.readings>0;
    if(!p)return {code:"unknown",label:"Configure os moradores"};
    if(day&&day.profileMixed)return {code:"unknown",label:"Configuração alterada no dia — comparação indisponível"};
    if(p.scope!=="whole")return {code:"unknown",label:"Medição por ramais — não representa toda a casa"};
    return classify(has?day.total1+day.total2:NaN,p.residents*p.referenceLiters,p.tolerance,{complete:closed&&day.partial===false,comparable:has&&connected});
  }
  const api={sources,activities,defaults,clone,profile,maybeProfile,m3,classify,estimate,dayProfile,compareDay};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.HydroConsumption=api;
})(typeof globalThis!=="undefined"?globalThis:this);
