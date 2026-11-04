# Relatório em PDF e valores da conta

O relatório transforma o histórico deste navegador em um PDF fácil de ler, com a água usada e os gastos estimados em reais.

## Como o usuário chega até ele

| Local | O que faz |
| --- | --- |
| Botão **Relatório PDF** no cabeçalho | Disponível em todas as páginas; abre a janela com o último período usado. |
| Cartão de destaque no **Painel** | Atalhos *Hoje*, *Este mês*, *Mês passado* e *Ano passado*. |
| **Meu consumo** | Abre a janela já com o período filtrado na página. |
| **Perfil da residência** | Botão *Gerar relatório PDF* no rodapé do painel lateral. |

A janela tem três etapas: **1. período**, **2. checklist do conteúdo**, com todas as seções marcadas e opções para desmarcar, e **3. valores da conta de água**. Ao lado fica uma prévia com o resumo e o número estimado de páginas.

## Cálculos (`financas.js`)

Os volumes ficam em litros internamente, como no restante do projeto, e o dinheiro em reais.

- **Custo da água medida** = volume em m³ × preço por m³ (água + esgoto).
- **Taxa fixa proporcional**: para cada dia do período, soma-se *taxa mensal ÷ dias daquele mês*. Um mês inteiro corresponde a exatamente uma taxa.
- **Gasto até agora** = custo da água medida + taxa fixa dos dias já passados.
- **Previsão / estimativa do período** = volume medido + média diária dos dias com leitura × dias sem leitura (passados ou futuros) + taxa fixa do período inteiro. Em períodos encerrados, aparece como *estimativa*.
- **Esperado pela referência** = moradores × referência por pessoa/dia × dias do período + taxa fixa. A referência padrão é o SNIS 2020 (152,1 L/hab/dia).
- **Comparação justa**: a diferença percentual compara medido × referência **somente nos dias com leitura**.
- **Meta mensal**: distribuída pelos dias de cada mês, do mesmo jeito que a taxa fixa.
- Dias sem leitura **não** contam como zero. Dias de demonstração só entram se o usuário marcar a opção, e aparecem como "Simulado".

## Valores da conta

Ficam salvos em `localStorage` na chave `hydrocasa:financeiro`, separados do ledger de medições:

```json
{ "version": 1, "pricePerM3": 12.5, "fixedMonthly": 30, "monthlyGoal": 200, "householdName": "Casa Silva" }
```

O assistente **Calcular pela minha conta** obtém o preço médio do m³ assim: *(valor total da conta − taxa fixa) ÷ m³ faturados*. Nenhuma tarifa de concessionária vem embutida: as tabelas mudam com frequência e costumam ser cobradas por faixa de consumo, então o valor calculado é uma média.

## Por que um gerador de PDF próprio (`pdf-simples.js`)

O site pode ser servido pelo ESP32 numa rede sem internet. Por isso o PDF é montado no navegador, sem CDN nem bibliotecas grandes. O gerador tem cerca de 12 KB e usa:

- as fontes padrão Helvetica e Helvetica-Bold, com codificação WinAnsi (acentos, `m³`, `R$`, `–`, aspas);
- formas vetoriais para cartões, barras e gráficos;
- o logo convertido para JPEG via `<canvas>`.

O arquivo é validado nos testes: estrutura, tabela `xref`, páginas e presença das seções.

## Testes

- `tests/financas.test.cjs`: períodos, validação, custos, previsões, atividades e alertas.
- `tests/relatorio.test.cjs`: codificação, quebra de linha, estrutura do PDF e seções marcadas e desmarcadas.
- `tests/ui-smoke.cjs`: fluxo completo no navegador, incluindo o download.

## Limitações

Os valores em reais são estimativas. Tarifas por faixa, impostos, multas e outras cobranças da fatura não são modelados. Coletas parciais podem subestimar o consumo. O relatório usa apenas o histórico salvo neste navegador.
