# Backlog e evidências — 14/10/2026

Este registro relaciona o trabalho aos cinco critérios da AC2, de peso igual (20%). Não garante nota e não substitui avaliação do professor.

| Prioridade | Categoria / item | Estado | Evidência ou próximo passo |
| --- | --- | --- | --- |
| P0 | Qualidade: cálculo, perfil, m³ e comparações | Implementado; validado em testes unitários | `data/consumption.js`, testes de consumo, histórico e conexão |
| P0 | Qualidade: validação integrada e visual | Pendente | Executar `tests/ui-smoke.cjs` com Chromium e revisar celular/desktop |
| P0 | Hardware: firmware, LittleFS e calibração | Pendente | Compilar, instalar, medir volumes conhecidos e documentar erro por sensor |
| P1 | Fundamentação: referências rastreáveis | Implementado | Fontes e condições na interface e em `CONSUMO.md` |
| P1 | Histórico confiável e persistente | Pendente | Persistir contadores no dispositivo; medir cobertura temporal; testar quedas de energia |
| P1 | Versionamento e decisões | Documentado | Commits separados de modelo, interface e documentação; `CHANGELOG.md` |
| P1 | Trabalho em equipe: contribuições verificáveis | Pendente de execução pela equipe | Distribuir responsáveis reais, registrar revisões, reuniões e testes físicos |
| P2 | Histórico de atividades por data | Pendente | Registros persistem, mas a lista da aba Atividades mostra somente hoje |
| P2 | Concorrência entre abas | Pendente | Evitar sobrescrita do histórico por múltiplas abas/navegadores |
| P2 | Referência local e atualizada | Pendente | Pesquisar indicador adequado à cidade e registrar população, período e metodologia |

## Histórico de atualização

- Versão anterior: correções de vazão, acúmulo além de 250 amostras, reset e falhas de conexão incorporadas à main.
- 13–14/10/2026: modelo de consumo, fontes explícitas, perfil, interface em m³, atividades e testes adicionados.
- 14/10/2026: 31 testes JavaScript e teste C++ aprovados; teste visual bloqueado pelo download do navegador. Pendências mantidas acima.

Responsáveis individuais e evidências de colaboração devem refletir ações reais da equipe; não foram atribuídos ou inventados nesta atualização.
