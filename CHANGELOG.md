# Histórico de versões

## 1.5.0 — 2026-11-14

### Adicionado
- **Ajuda "?"** (`ajuda.js`): círculo com "?" ao lado de títulos e números. Ao clicar, abre a explicação; ela fecha com Esc, com clique fora ou com o ×, não fecha sozinha durante as atualizações ao vivo e, no celular, abre como uma folha na parte de baixo da tela. Pode ser usada em HTML estático com `data-ajuda="..."`.
- Explicações mais completas dentro das ajudas: o que entra no total do dia e por que o dia pode ser parcial, o que é m³, como o esperado é calculado (SNIS, margem) e como ler o círculo, o quadro "Agora", como ler cada gráfico e as cores, como a previsão e o valor em reais são calculados, o ritmo atual, ideias de economia com valores das fontes, como funciona o Justificar consumo (de onde vêm os valores de cada atividade), alertas, aviso de água correndo, conectividade, calibração do sensor e onde os dados ficam.

### Alterado
- Textos de apoio secundários saíram da tela e foram para as ajudas: subtítulos dos gráficos, nota de cálculo da conta, explicação do simulador, nota das atividades e descrições da aba Sistema. Números, situação do dia, previsão, avisos e passos do Justificar consumo continuam visíveis.
- Os ícones "!" de informação da área técnica passaram a "?".

## 1.4.0 — 2026-11-14

### Adicionado
- **Quanto sua água custa** (Painel, logo abaixo de "Hoje na sua casa"): gasto até agora e **previsão para hoje, esta semana, este mês ou este ano**, comparados com o esperado para os moradores e com a meta, em barras na mesma escala e com uma frase direta ("se continuar assim, o mês vai custar R$ X a mais do que o esperado").
- **Quanto custa no ritmo atual:** média dos últimos 7 dias medidos convertida em custo por dia, semana, mês, ano e por pessoa, destacando o que passa do esperado.
- **E se a casa economizar?** Simulador: arraste quantos litros economizar por dia e veja quanto isso representa no mês e no ano, e como ficaria a conta do mês (com o equivalente em minutos de ducha).
- Sem preço da água, tudo aparece em litros, com um convite para informar o preço.
- Período **Esta semana** (domingo a sábado) também no relatório em PDF.

### Alterado
- Previsões (Painel e PDF): o dia de hoje, ainda em andamento, não puxa mais a média para baixo — conta como o maior valor entre o já medido e a média dos outros dias; sem outros dias, a previsão segue o ritmo de hoje.
- Textos em linguagem simples: avisos e alertas ("a casa usou 520 L, 64 L além do limite…"), faixa de tom do site ("Hoje a casa já usou 27% a mais que o esperado"), níveis ("Um pouco acima / Acima / Bem acima / Muito acima do esperado"), faixa do perfil em litros, aba **Análise → Detalhes** com rótulos explicados.
- Cada bloco do Painel é atualizado separadamente: uma falha em um deles não apaga os outros.

## 1.3.0 — 2026-11-14

Foco: deixar o site claro para quem não é técnico.

### Adicionado
- **Hoje na sua casa** (topo do Painel): consumo do dia em **litros** (com o equivalente em m³ da conta), situação em palavras simples com as mesmas faixas de cor do site, medidor circular do esperado para os moradores, custo de hoje e previsão da conta do mês, **água correndo agora** em cada sensor, comparação com ontem e com a média de 7 dias, e uma dica ligada ao ponto que mais gastou.
- **Gráficos novos:** "Quando a água foi usada hoje" (litros por hora), "Últimos 7 dias" com linha do esperado e cor por faixa, e "Onde a água foi usada hoje" por sensor. O app passa a guardar o volume de cada hora do dia (`hours` no histórico), sem alterar os totais.
- **Aviso de água correndo sem parar:** alerta vermelho no topo quando um sensor mede fluxo contínuo pelo tempo escolhido em Sistema (1 a 60 min; padrão 20), com passo a passo para verificar torneiras, descarga e vazamentos. Botão para mostrar um aviso de teste na apresentação.
- **Boas-vindas guiada** no primeiro acesso (5 passos): moradores, nome dos sensores, se medem a casa toda, preço da água (com cálculo pela conta) e convite para o tour.

### Alterado
- **Justificar consumo** (antiga aba Atividades) refeito como assistente: escolher o dia (hoje, ontem ou outra data), tocar na atividade com ícone, ajustar pessoas, vezes e minutos com botões, ver os litros e o custo antes de salvar e acompanhar o **balanço do dia** (medido × explicado, quanto falta explicar). Registros podem ser editados e a remoção pode ser desfeita. O formato salvo é o mesmo de antes.
- O botão "Justificar consumo deste dia" do calendário abre o assistente já na data escolhida.
- Com o perfil configurado, o Painel começa direto pelos números (a apresentação e os primeiros passos ficam para o primeiro acesso). Números técnicos (m³, vazão, status) ficam em "Ver todos os números". Dados demonstrativos foram para a aba Sistema.
- Tour guiado reescrito para o novo Painel; alertas do Painel mostram o mais importante primeiro (também no celular); menu de páginas rola na horizontal no celular.
- Textos de "Sobre nós" e "Fontes e estudos" atualizados sobre o aviso de água correndo.

## 1.2.2 — 2026-11-04

### Corrigido
- A pasta `data/` não cabia na partição LittleFS padrão do ESP32 (1.441.792 bytes): o upload falhava com "File system is full".
  - `hydrocasa-symbol.png` reduzido de 1254 px (794 KB) para 512 px (148 KB), sem perda visível (a maior exibição no site é de 180 px).
  - Removido `hydrocasa-logo.jpeg` (115 KB), que o site não usava, e sua rota no firmware.
  - A pasta passou de 1,38 MB para 0,61 MB (cerca de 43% da partição).

## 1.2.1 — 2026-11-04

### Adicionado
- Tom visual do site conforme o gasto em relação à referência dos moradores: **levemente acima** (até 25%) amarelado, **moderadamente** (até 50%) laranja, **alto** (até 100%) vermelho e **extremamente acima** (mais que o dobro) vermelho escuro. Uma faixa sob o cabeçalho explica o motivo. Dentro da tolerância do perfil, o site fica no tom normal.
- Usa o consumo de hoje (ou o dia mais recente com leituras); com a semana demonstrativa ativa, usa o dia simulado.

## 1.2.0 — 2026-11-04

### Adicionado
- **Relatório em PDF** completo, gerado no navegador e sem internet (gerador próprio `pdf-simples.js`, compatível com o ESP32).
  - Acesso pelo botão **Relatório PDF** no cabeçalho (todas as páginas), pelo cartão de destaque no Painel (atalhos Hoje, Este mês, Mês passado, Ano passado) e por **Meu consumo** (usa o período filtrado).
  - Períodos: hoje, ontem, dia específico, últimos 7 e 30 dias, este mês, mês passado, mês específico, este ano, ano passado e personalizado (até 366 dias).
  - Checklist com 12 seções (resumo, gastos em reais, comparação com o esperado, gráfico, ramais, tabela, destaques, atividades, alertas, dicas, perfil/tarifa e metodologia), com "Marcar tudo", "Só o essencial" e "Desmarcar tudo".
  - Prévia ao vivo com água medida, gasto até agora, previsão, esperado e número estimado de páginas.
- **Valores da conta de água**: preço por m³, taxa fixa mensal, meta de gasto e nome da residência; assistente que calcula o preço do m³ pela própria conta.
- Cálculos financeiros (`financas.js`): gasto medido, taxa fixa proporcional, previsão do período, valor esperado pela referência, meta e custo por ramal, atividade e morador.
- **Perfil da residência dinâmico**: painel lateral com avatares dos moradores, progresso do perfil, consumo de hoje e gasto do mês ao vivo, edição rápida com pré-visualização e itens para completar o perfil.
- Cartão de moradores mostra a referência diária/mensal e a conta esperada enquanto o número é alterado.
- Primeiro acesso compacto depois que o perfil é configurado, com opção de reabrir o guia.
- Testes `financas.test.cjs` e `relatorio.test.cjs`; teste de navegador atualizado.

### Corrigido
- O diálogo "ESP32 conectado — remover demonstração?" aparecia para quem nunca criou demonstração: a publicação inicial do simulador era tratada como escolha do usuário.
- A publicação inicial do simulador apagava, a cada recarga, a semana demonstrativa personalizada.
- Texto do perfil descrevia um comportamento antigo para mudanças de perfil no mesmo dia.
- Cabeçalho cortava o nome do site em celulares.
- Testes desatualizados (reset removido, rótulos de conexão, mudança de perfil, alerta de coleta parcial e campos removidos do teste de navegador).

### Verificação
- 52 testes JavaScript, regras de alertas, teste C++ e teste de navegador aprovados.
- Firmware não compilado neste ambiente; rotas novas adicionadas ao `HydroCasa.ino`.

## 1.1.0 — 2026-10-14

### Adicionado
- Perfil de moradores, abrangência, nomes dos ramais e referência diária ajustável.
- Modelo puro de consumo, condições de uso e fontes acessíveis na interface.
- Aba Atividades com estimativas, volume manual observado e registros persistidos.
- Testes de consumo/perfil e roteiro automatizado de navegador.
- Documentação das decisões, backlog priorizado, limitações e reversão.

### Alterado
- Volumes exibidos em m³ e vazões em m³/min; protocolo interno preservado em litros.
- Comparação considera cobertura, coleta parcial e mudanças de perfil; remove limiar fixo residencial.
- Estimativas de atividades ficam separadas das medições dos sensores.
- Firmware serve o novo arquivo `consumption.js`.

### Verificação
- 31 testes JavaScript e teste C++ aprovados.
- Navegador e dispositivo físico pendentes; consulte `docs/CONSUMO.md`.

## Base anterior

Correções de vazão, histórico e tratamento de falhas publicadas no PR #1. Esta seção não atribui retroativamente uma tag à versão anterior.
