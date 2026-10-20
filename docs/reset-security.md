# Segurança do reset remoto — HydroCasa

O painel público NÃO expõe ou executa o reset. O endpoint do firmware `POST /api/reset` precisa de uma autorização própria antes de ser disponibilizado por uma interface técnica.

## Requisito obrigatório do firmware
1. Recusar requisições anônimas com HTTP 401/403 e nunca efetuar reset antes de validar credenciais.
2. Autenticar no firmware (ou num proxy HTTPS autenticado de confiança) por sessão/autorização, não por um PIN somente comparado no navegador.
3. Nunca incorporar token, senha ou PIN em HTML, CSS, JS, commits ou parâmetros de URL.
4. Guardar segredos em armazenamento seguro do dispositivo/provisionamento fora do repositório. Na rede local HTTP, credenciais podem ser interceptadas; para acesso remoto usar HTTPS via gateway confiável.
5. Limitar tentativas, registrar data/hora do reset autenticado no servidor e restringir CORS/origem quando aplicável. CORS, sozinho, não é autenticação.
6. Exigir uma segunda confirmação explícita com `ZERAR` na interface técnica, após autenticação de verdade; oferecer exportação do histórico antes da operação.
7. Verificar novamente privilégios no momento do POST e retornar um JSON `{ok:true, reset_at:"..."}` no sucesso.

### Fluxo sugerido (pseudocódigo C++ para adaptar à biblioteca HTTP usada pelo projeto)

```cpp
void handleReset() {
  // ATENÇÃO: implementação ilustrativa, NÃO pronta para uso sem TLS e autenticação.
  // A função isAuthorizedRequest deve verificar sessão/credencial gerada
  // por backend HTTPS confiável; não usar token hardcoded no frontend.
  if (!isAuthorizedRequest()) {
    server.send(403, "application/json", "{\"ok\":false,\"error\":\"acesso_negado\"}");
    return;
  }
  if (!isResetRateAllowed()) {
    server.send(429, "application/json", "{\"ok\":false,\"error\":\"limite\"}");
    return;
  }
  // Fazer snapshot/persistir estado e executar rotina REAL de reset já existente.
  performAuthenticatedReset();
  server.send(200, "application/json", "{\"ok\":true}");
}
```

**Atenção:** até implementar e testar a autorização no firmware, bloquear /api/reset no servidor ou restringi-lo fisicamente à rede/equipamento. Remover o botão do frontend **não impede uma chamada HTTP direta** à rota.
