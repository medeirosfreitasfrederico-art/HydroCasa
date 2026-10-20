# Divulgação e revisão da interface

## Exportar imagem de compartilhamento
A arte editável está em `data/hydrocasa-og.svg` (1200 × 630). No computador de desenvolvimento:

```bash
python -m pip install cairosvg
python scripts/export-og-image.py
```

Publicar `hydrocasa-og.png` na mesma pasta estática que `index.html` e atualizar **og:image** e **twitter:image** de `hydrocasa-og.svg` para `hydrocasa-og.png`. SVG pode não gerar prévia em WhatsApp/LinkedIn; a entrega de PNG é necessária para maior compatibilidade. Testar: https://www.opengraph.xyz/ , https://developers.facebook.com/tools/debug/ e https://www.linkedin.com/post-inspector/ . Após publicar, fazer nova inspeção (Scrape Again/Inspect) e, se necessário, versão nova na URL do PNG para invalidar cache.

## Microcopy — alterações efetuadas
| Antes | Depois | Ressalva completa |
| --- | --- | --- |
| Sem diagnóstico de desperdício ou vazamento. | Aguardando referência. | Fontes e estudos → Limitações e metodologia; ícone ⓘ |
| Divisão do volume observado; não identifica consumo individual. | Média do volume registrado por morador. | Fontes e estudos → Limitações e metodologia; ícone ⓘ |
| Regra do projeto; 10% não é uma tolerância oficial da fonte. | Margem ajustável do projeto. | Fontes e estudos → Limitações e metodologia |
| Nenhuma informação é simulada nesta página. | Leituras e histórico disponíveis no painel. | Fontes e estudos → Limitações e metodologia |
| Texto amplo da comparação dinâmica sobre desperdício ou vazamento | Estado curto da comparação | Fontes e estudos → Limitações e metodologia |

## Principais CTAs
| Rótulo | Destino | Local |
| --- | --- | --- |
| Ver indicadores | #todayTotal | Abertura do Painel |
| Sobre o projeto | ?pagina=sobre | Abertura do Painel |
| Configurar perfil | #householdTitle | Primeiros passos |
| Ver indicadores | #todayTotal | Primeiros passos |
| Abrir calendário | Aba Calendário | Primeiros passos |
| Conhecer o HydroCasa | Tour guiado | Painel |
| Fontes e metodologia | ?pagina=fontes#limitations | Sistema |

Os demais links internos preexistentes permanecem com o mesmo destino; revisar duplicatas visualmente antes de publicar.
