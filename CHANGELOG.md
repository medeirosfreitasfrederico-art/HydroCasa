# Histórico de versões

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
