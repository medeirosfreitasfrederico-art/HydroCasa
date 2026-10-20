# Camada de demonstração HydroCasa

## Arquivos e limites
- **Novos**: `demo-overlay.js`, `demo-overlay.css` (somente apresentação e armazenamento da sessão).
- **Integrações pontuais**: `index.html` (CSS/JS, faixa, iframe com carregamento imediato) e `simulador.html` (emissão numérica por `postMessage`, limpeza de controles).
- **Inalterado**: `app.js`, `consumption.js`, firmware ESP32, `consumption-status.js`, APIs, `/api/live`, `/api/daily`, `/api/reset`, snapshots, contadores, histórico, calendário e lógica real.

## Chaves e endpoints
- Demonstração: apenas `sessionStorage['hydrocasa:simulacao']` e `sessionStorage['hydrocasa:simulacao:asked']`.
- O overlay **lê** `localStorage['hydrocasa_ledger_v2']`, apenas para decidir se há histórico real.
- Endpoints acionados pela demonstração: **nenhum**.
- PostMessage do simulador: `hydrocasa-demo-values`, `hydrocasa-demo-clear`, `hydrocasa-demo-clear-inputs`. Somente eventos recebidos do iframe específico, de origem sandbox `null`, com cinco números validados. O iframe permanece sem `allow-same-origin`.
- O histórico real é a fonte prioritária. Havendo qualquer leitura real registrada, a camada fictícia NÃO se sobrepõe a números reais. Nesse caso, selecionar “Manter” preserva o cenário apenas no Simulador; não força exibição sobre histórico real.

## Mapeamento
| Simulador | Demonstração no Painel |
| --- | --- |
| Pessoas × minutos × banhos × vazão | Estimativa diária de banho em `todayTotal` |
| Minutos × banhos × vazão | Consumo demonstrativo por morador |
| Período | Exibido somente no Simulador, como projeção; não vira histórico diário |
| Pessoas | Somente cópia do cenário, não atualiza perfil real |
| Vazão | Apenas fórmula educativa; não altera `flow1` ou `flow2` |
| Ramal 01, Ramal 02, distribuição | Não calculados: não existem leituras separadas por ramal |
| Comparação à referência | Sem classificação, pois a estimativa representa só os banhos |

## Checklist manual
- [ ] Abrir Painel sem ESP32 e sem histórico; verificar aviso “Demonstração” e selos junto aos números.
- [ ] Alterar todos os controles do simulador; voltar ao Painel; verificar estimativa diária e por morador.
- [ ] Recarregar a mesma aba: dados demonstrativos devem persistir via sessionStorage.
- [ ] Fechar a aba e abrir outra: demonstração não deve sobreviver (dependendo da política do navegador para restaurar sessão).
- [ ] Conectar ESP32 com primeira leitura válida; confirmar diálogo e testar Remover / Manter.
- [ ] Conectar sem simulação; verificar ausência de diálogo.
- [ ] Oscilar conexão; não repetir diálogo após “Manter”.
- [ ] Conferir que histórico, calendário, gráficos reais, exportação e perfil permanecem iguais antes e depois.
- [ ] Testar ESP32 conectado com histórico real: mexer no simulador não pode alterar números reais.
- [ ] Testar Esc, clique fora, Tab, Shift+Tab e foco restaurado no modal.
- [ ] Conferir tema claro/escuro e telefone.
