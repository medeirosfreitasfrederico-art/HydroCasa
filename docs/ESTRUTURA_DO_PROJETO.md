# Organização do repositório HydroCasa

Este guia descreve **a estrutura efetivamente utilizada**, a função dos arquivos e os nomes das páginas. O diretório `data/` é mantido plano propositalmente: o ESP32/LittleFS e os links relativos do HTML dependem dessa estrutura. Não mover páginas, scripts ou imagens sem atualizar todas as referências, o processo de publicação e os testes.

## Visão das pastas

```text
HydroCasa/
├── README.md                     # Apresentação do projeto
├── CHANGELOG.md                  # Histórico de alterações
├── docs/                         # Documentação do desenvolvimento
│   ├── ESTRUTURA_DO_PROJETO.md   # Este mapa de navegação
│   ├── BACKLOG.md
│   ├── CONSUMO.md
│   ├── demo-overlay.md
│   ├── interface-review.md
│   └── reset-security.md
├── scripts/                      # Ferramentas auxiliares
│   └── export-og-image.py
├── tests/                        # Testes automatizados
└── HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/
    └── HydroCasa_ESP32_LittleFS1.0.0/
        ├── HydroCasa.ino         # Firmware ESP32
        ├── FlowSample.h          # Leitura de fluxo
        ├── README.md             # Instruções do firmware
        ├── Produto HydroCasa.jpeg
        ├── hydrocasa-produto.jpg
        ├── hydrocasa-produto.webp
        └── data/                 # Raiz dos arquivos distribuídos pelo LittleFS
            ├── index.html        # Todas as páginas principais do site
            ├── simulador.html    # Simulador isolado em iframe
            ├── app.js
            ├── style.css
            ├── mobile.css
            ├── tour.js / tour.css
            ├── alertas.js / alertas-ui.js / alertas-config.js / alertas.css
            ├── consumption.js / consumption-status.js / consumption-status.css
            ├── dashboard-ux.js / dashboard-ux.css
            ├── demo-overlay.js / demo-overlay.css
            ├── hero.css / system-improvements.css
            ├── hydrocasa-logo.jpeg / hydrocasa-symbol.png / hydrocasa-og.svg
            ├── icon-alerta.svg / icon-perfil.svg
            ├── alertas.test.js
            └── README_LITTLEFS.txt
```

## Mapa das páginas e dos arquivos

| Nome exibido no site | Endereço / navegação | Arquivo principal | Descrição |
| --- | --- | --- | --- |
| Painel / Visão geral | `/` | `data/index.html` | Dashboard de leituras, indicadores e acompanhamento |
| Meu consumo | `/?pagina=consumo` | `data/index.html` | Histórico e análise de consumo |
| Simulador | `/?pagina=simulador` | `data/index.html` + `data/simulador.html` | Estimativas isoladas de medições reais |
| Sobre nós | `/?pagina=sobre` | `data/index.html` | Apresentação e equipe do projeto |
| Fontes e estudos | `/?pagina=fontes` | `data/index.html` | Referências e metodologia |

**Importante:** essas páginas são seções de `index.html`, e não arquivos HTML independentes. A nomenclatura acima é a forma correta de encontrá-las sem modificar roteamento, links ou scripts. O Simulador é o único HTML isolado. Outras abas internas, como Calendário, Análise e Sistema, também pertencem à interface do Painel.

## Separação de responsabilidades

- **Layout e temas:** `style.css`, `mobile.css`, `hero.css`, `dashboard-ux.css`, `system-improvements.css`.
- **Navegação e leituras:** `index.html`, `app.js`, `consumption.js`, `consumption-status.js`.
- **Tour guiado:** `tour.js`, `tour.css`.
- **Alertas:** `alertas.js`, `alertas-ui.js`, `alertas-config.js`, `alertas.css`.
- **Simulação:** `simulador.html`, `demo-overlay.js`, `demo-overlay.css`; valores simulados não devem substituir medições reais.
- **Imagens:** nomes `hydrocasa-*`, `icon-*` e arquivos de representação do produto. Os caminhos no HTML precisam corresponder a arquivos publicados.
- **Firmware:** `HydroCasa.ino` e `FlowSample.h`.
- **Testes e documentos:** pastas `tests/` e `docs/`.

## Convenção de organização para próximas alterações

Novos documentos: `docs/`. Novos testes do projeto: `tests/`. Scripts de manutenção: `scripts/`. Recursos consumidos diretamente pelo site/ESP32: `data/` e nomes em minúsculas com hífens quando possível. Para mudanças futuras na organização física de `data/`, fazer migração coordenada de caminhos relativos, firmware, hospedagem, testes e cache.

## Funcionalidade opcional futura

**Política de Privacidade e Termos de Uso**: apenas backlog opcional no Trello, **não implementada** nem considerada requisito entregue. Quando aprovada, revisar tratamento de dados, armazenamento local, funcionalidades reais e necessidade de avaliação jurídica/LGPD antes de adicionar links no rodapé.
