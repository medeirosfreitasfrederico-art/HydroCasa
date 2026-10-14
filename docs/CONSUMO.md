# Consumo por moradores e atividades — versão 1.1.0

## Uso e decisões

No perfil da residência, informe de 1 a 100 moradores e clique em **Aplicar perfil**. A referência diária é moradores × referência por pessoa/dia. Quatro moradores com 152,1 L/pessoa/dia correspondem a **0,6084 m³/dia**. A referência pode ser personalizada; nesse caso a interface a identifica como hipótese do usuário.

A referência inicial é histórica: média nacional agregada do SNIS de **2020**, publicada pelo MDR em 2022. Não representa uma recomendação, uma média atual de Sorocaba ou um limite legal. A faixa inicial de ±10% é uma convenção ajustável do projeto (0–50%), sem atribuição à fonte.

Os ramais precisam cobrir a casa inteira, sem sobreposição, para comparação residencial. O padrão é medição parcial por ramais. Não some sensores em série: isso contabilizaria a mesma água duas vezes. A divisão por moradores é uma média do volume monitorado, não identifica consumo individual.

Dias parciais não recebem classificação final abaixo/dentro da faixa. Se o volume observado já ultrapassou a faixa diária, pode haver aviso de ultrapassagem. O coletor atual mantém todos os dias como parciais porque não comprova cobertura integral. Alterar moradores, referência, tolerância ou abrangência depois de iniciar a coleta impede classificação única naquele dia; perfis anteriores ficam preservados.

## Atividades e fontes

A aba **Atividades** apresenta fonte, link, condições e fórmula em “Fonte e cálculo”. Esses exemplos educativos não são médias universais.

| Atividade | Referência publicada | Aplicação |
| --- | --- | --- |
| Chuveiro elétrico | 45 L / 15 min | Duração × ocorrências por morador × moradores |
| Ducha | 135 L / 15 min | Duração × ocorrências por morador × moradores |
| Louça com torneira | 117 L / 15 min | Duração × ocorrências da casa |
| Louça em cuba | 20 L / ocorrência | Ocorrências da casa |
| Máquina de roupas de 5 kg | 135 L / ciclo | Ciclos da casa |
| Rega com mangueira | 186 L / 10 min | Duração × ocorrências da casa |
| Carro com baldes | 40 L / ocorrência | Ocorrências da casa |
| Calçada com mangueira | 279 L / 15 min | Duração × ocorrências da casa |
| Piscina e limpeza da casa | Volume informado pelo usuário | Hipótese personalizada, sem média oficial |

- [MDR/SNIS — diagnóstico, dados de 2020](https://www.gov.br/mdr/pt-br/noticias/mdr-lanca-diagnostico-sobre-servicos-publicos-de-abastecimento-de-agua): referência diária agregada.
- [SAAE Ambiental de Santa Fé do Sul — Dicas de Economia](https://saaeambientalsantafe.sp.gov.br/meio-ambiente/dicas-de-economia): chuveiro elétrico, ducha, louça com torneira, máquina e calçada. Valores condicionados ao equipamento e abertura indicados na interface.
- [Câmara dos Deputados/EcoCâmara — Como economizar água](https://www2.camara.leg.br/a-camara/estruturaadm/gestao-na-camara-dos-deputados/responsabilidade-social-e-ambiental/ecocamara/noticias/Comoeconomizaragua.html): cuba, rega e carro; a publicação atribui os exemplos à Sabesp.

Fontes consultadas em 13/10/2026. Conversão: **1 m³ = 1.000 L**. API, calibração e histórico interno continuam em litros; apresentação em m³ e vazão em m³/min. A proporcionalidade por minutos pressupõe vazão constante.

Os sensores não identificam atividades automaticamente. O volume observado da atividade é informado manualmente após concluir todas as ocorrências calculadas. A comparação desse total com a estimativa pode indicar abaixo/dentro/acima. Usos compartilhados, como louça, não são multiplicados novamente pelos moradores. As estimativas não são somadas à referência residencial nem subtraídas das medições. Registros antigos são preservados como estimativas sem fonte validada.

## Instalação e verificação

Atualize **o firmware e todos os arquivos da pasta `data/` no LittleFS**, incluindo `consumption.js`. O firmware inclui a rota para esse arquivo. Publicar no GitHub não atualiza o ESP32 automaticamente. Faça uma cópia/exportação dos dados locais antes de manutenção; o histórico depende deste navegador/origem e não é um backup no dispositivo.

Na raiz do repositório:

```sh
node --test tests/*.test.cjs
g++ -std=c++11 -Wall -Wextra -pedantic tests/flow_sample.cpp -o /tmp/hydrocasa-flow-test
/tmp/hydrocasa-flow-test
```

Resultado em 14/10/2026: **31 testes JavaScript aprovados** e teste C++ aprovado. Cobertura: conversão, fórmulas, limites de comparação, fonte de referências, histórico, mudança de perfil, reinício/reset, respostas inválidas e falhas de conexão/armazenamento.

Teste adicional de navegador, com Playwright instalado e Chromium disponível:

```sh
node tests/ui-smoke.cjs
```

Esse teste usa servidor local e API simulada. **Não foi concluído neste ambiente:** download do Chromium retornou arquivo inválido/truncado. Não houve compilação integral do firmware nem teste físico no ESP32. Validação visual, upload LittleFS, funcionamento offline, calibração e medição de volumes conhecidos continuam pendentes.

## Reversão

As mudanças são separadas em commits. Para desfazer uma versão publicada, reverta os commits do mais recente ao mais antigo com `git revert <sha>` e publique a reversão. Isso preserva o histórico compartilhado. Para reverter o dispositivo, reinstale o firmware e os arquivos LittleFS da versão anterior. Reverter código não restaura dados apagados do navegador.
