# Histórico de versões

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
