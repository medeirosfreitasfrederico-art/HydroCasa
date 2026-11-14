# Roteiro de apresentação — HydroCasa 1.3.0

Este roteiro leva de 5 a 7 minutos e mostra o site rodando no ESP32. Ele não depende de internet.

## Antes de começar (no dia)

1. **Firmware e site:** grave o `HydroCasa.ino` e envie a pasta `data/` inteira pelo LittleFS. Os arquivos novos já têm rota no firmware: `inicio.js`, `inicio.css`, `atividades.js` e `atividades.css`.
2. **Endereço:** abra o Serial Monitor (115200), aperte EN/RST e anote a linha com o IP. Abra `http://IP_DO_ESP32/` no notebook, que precisa estar na mesma rede Wi-Fi 2,4 GHz.
3. **Começar do zero:** em **Painel → Sistema → Zerar dados deste navegador**. Assim a boas-vindas guiada aparece na frente da banca.
4. **Aviso de água correndo:** ainda em Sistema, escolha **Avisar depois de 1 minuto**. Assim o aviso aparece durante a demonstração.

## Demonstração

| # | O que fazer | O que falar |
|---|---|---|
| 1 | Recarregue a página. A **boas-vindas** abre. Informe os moradores, nomeie os sensores (ex.: Cozinha e Banheiro), deixe "Sim, toda a água passa por eles" e informe o preço do m³ (ou calcule pela conta). | "Qualquer pessoa configura em 1 minuto, sem termos técnicos." |
| 2 | Mostre **Hoje na sua casa**. Abra a torneira da maquete. | "O consumo aparece em litros, com o equivalente em m³ da conta. O círculo compara com o esperado para quem mora na casa. O quadro **Agora** mostra a água correndo em cada sensor, ao vivo." |
| 3 | Deixe a água correndo por mais de 1 minuto. | "Se a água fica correndo sem parar, o painel avisa em vermelho e explica como verificar torneira, descarga ou vazamento." Clique em **Está tudo bem, é uso normal** e feche a torneira. |
| 4 | Role até os **gráficos**. | "Dá para ver em que hora a água foi usada, os últimos 7 dias comparados com o esperado (verde dentro, amarelo, laranja e vermelho acima) e quanto cada ponto da casa gastou." |
| 5 | Clique em **Justificar o consumo de hoje**. Escolha **Banho → Ducha → 15 min** e depois **Adicionar ao dia de hoje**. | "Os sensores medem quanto passou, mas não em quê. Aqui a pessoa conta o que fez, e o **balanço do dia** mostra quanto da água medida ficou explicado e quanto falta explicar." Mostre **Remover** e **Desfazer**. |
| 6 | Clique em **Relatório PDF**, escolha **Este mês** e baixe. | "O relatório completo é gerado no próprio navegador, sem internet." |
| 7 | Se sobrar tempo: **Como funciona? Fazer o tour**. | Passeio guiado pelo painel. |

## Plano B (sem ESP32 ou sem Wi-Fi)

- **Aviso de teste:** em **Sistema**, clique em **Mostrar um aviso de teste**. O aviso aparece com o rótulo [TESTE].
- **Dados fictícios:** em **Sistema → Personalizar dados demonstrativos**, aplique a semana fictícia. O painel inteiro passa a mostrar a etiqueta **DEMONSTRAÇÃO**, com gráficos e situação do dia calculados a partir desses valores.
- **Abrir o site sem o ESP32:** sirva a pasta `data/` no notebook (por exemplo, `python -m http.server` dentro de `data/`) e abra `http://localhost:8000/`. Sem a API, o painel indica que este endereço não recebe dados do ESP32.

## Perguntas prováveis

- **Detecta vazamento?** Ele avisa quando há fluxo contínuo pelo tempo escolhido. Isso pode indicar torneira aberta, descarga com defeito ou vazamento, mas confirmar a causa exige verificar no local.
- **De onde vem o "esperado"?** Da média nacional do SNIS (2020), 152,1 L por pessoa por dia, multiplicada pelo número de moradores. Os valores das atividades vêm do SAAE e da Câmara/Sabesp, com links em **Fontes e estudos**.
- **Onde ficam os dados?** No navegador (`localStorage`). O ESP32 guarda os contadores. Nada vai para a internet.
