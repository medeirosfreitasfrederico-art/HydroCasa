# 💧 HydroCasa

### Sistema inteligente de monitoramento do consumo residencial de água

O **HydroCasa** é um projeto de IoT desenvolvido para monitorar o consumo de água em ambientes residenciais utilizando sensores de fluxo e um **ESP32**.

A proposta é transformar o fluxo de água em dados compreensíveis para o usuário, permitindo acompanhar o consumo, estimar seu custo financeiro e identificar comportamentos que possam indicar desperdícios ou vazamentos.

O projeto foi desenvolvido como parte da disciplina de **Usina de Projetos Experimentais (UPx)** da **Facens**.

---

## 📌 Sobre o projeto

Grande parte do acompanhamento do consumo residencial de água ocorre por meio da conta mensal ou da leitura periódica do hidrômetro. Isso dificulta perceber **quando**, **onde** e **quanto** de água está sendo consumido.

O HydroCasa propõe uma camada adicional de monitoramento sobre esse processo.

Por meio de sensores instalados na tubulação, o sistema coleta informações sobre a passagem da água e utiliza o ESP32 para processar esses dados.

A ideia central é:

> **Medir → Processar → Visualizar → Interpretar → Agir**

Dessa forma, o usuário deixa de ter acesso apenas ao consumo acumulado e passa a ter informações que podem auxiliar na tomada de decisões e na identificação de desperdícios.

---

## 🎯 Objetivo

Desenvolver um protótipo de sistema inteligente capaz de **monitorar o consumo hídrico residencial em tempo real**, transformando os dados coletados em informações acessíveis ao usuário.

Entre os principais objetivos estão:

* Monitorar a vazão de água;
* Registrar o volume consumido;
* Apresentar informações de consumo;
* Estimar o custo financeiro relacionado ao consumo;
* Permitir o acompanhamento do histórico;
* Identificar padrões anormais de consumo;
* Auxiliar na identificação de possíveis desperdícios ou vazamentos;
* Estimular um comportamento mais consciente em relação ao uso da água.

---

## 🧠 Conceito do sistema

O funcionamento geral do HydroCasa pode ser representado pela seguinte arquitetura:

```text
┌─────────────────────┐
│   Fluxo de água     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sensor de fluxo    │
└──────────┬──────────┘
           │ Pulsos
           ▼
┌─────────────────────┐
│       ESP32         │
│                     │
│ • Leitura           │
│ • Processamento     │
│ • Cálculos          │
│ • Comunicação       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Dados de consumo   │
│                     │
│ • Vazão             │
│ • Volume            │
│ • Histórico         │
│ • Custo estimado    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Interface do usuário│
└─────────────────────┘
```

O **sensor de fluxo** é responsável por detectar a passagem da água. Esses sinais são interpretados pelo ESP32, que realiza o processamento necessário para transformar os pulsos recebidos em informações de consumo.

---

## ⚙️ Funcionamento

### 1. Medição

O sensor de fluxo monitora a passagem da água pela tubulação.

A movimentação da água gera sinais que podem ser contabilizados pelo microcontrolador.

### 2. Processamento

O ESP32 recebe os sinais provenientes do sensor e realiza os cálculos necessários para determinar as informações relacionadas ao consumo.

Entre elas estão:

* Vazão;
* Volume consumido;
* Consumo acumulado;
* Estimativa financeira.

### 3. Disponibilização dos dados

Os dados processados são utilizados pela interface do sistema para apresentar as informações de maneira mais simples e compreensível.

O objetivo é evitar que o usuário precise interpretar diretamente os dados brutos do sensor.

### 4. Análise

A partir do acompanhamento do consumo, torna-se possível observar comportamentos fora do padrão.

Por exemplo:

```text
Consumo normal
      │
      ├── Uso eventual
      ├── Uso contínuo
      └── Uso elevado
                │
                ▼
       Possível desperdício
                │
                ▼
       Investigar vazamento
```

---

## 🔌 Hardware

O protótipo utiliza uma arquitetura baseada em microcontrolador e sensores de fluxo.

### Principais componentes

| Componente                | Função                                  |
| ------------------------- | --------------------------------------- |
| **ESP32**                 | Processamento e controle do sistema     |
| **Sensor de fluxo**       | Medição da passagem de água             |
| **Tubulações**            | Condução da água no protótipo           |
| **Reservatório**          | Representação da fonte de abastecimento |
| **Protótipo residencial** | Representação do ambiente de aplicação  |

O ESP32 foi utilizado como núcleo do sistema por permitir processamento local e conectividade, possibilitando a construção de uma solução IoT de baixo custo.

---

## 💻 Software

O projeto utiliza uma arquitetura embarcada baseada no ESP32.

A estrutura disponível no repositório inclui uma implementação denominada:

```text
HydroCasa_ESP32_LittleFS
```

O **LittleFS** é utilizado como sistema de arquivos do ESP32 para armazenar os arquivos necessários ao funcionamento da aplicação embarcada.

### Tecnologias

* **ESP32**
* **C/C++**
* **Arduino**
* **LittleFS**
* **HTML**
* **CSS**
* **JavaScript**
* **IoT**

---

## 📂 Estrutura do projeto

A estrutura principal do repositório está organizada em torno da aplicação embarcada do HydroCasa:

```text
HydroCasa/
│
└── HydroCasa_ESP32_LittleFS/
    │
    ├── Código do ESP32
    │
    ├── Arquivos da aplicação
    │
    └── Arquivos armazenados no LittleFS
    │
    └── ...
```

A separação entre o código do microcontrolador e os arquivos armazenados no sistema de arquivos permite que o ESP32 atue não apenas como controlador dos sensores, mas também como parte da infraestrutura da aplicação.

---

## 📊 Informações monitoradas

O sistema foi projetado para trabalhar com diferentes informações relacionadas ao consumo:

### 💧 Vazão

Quantidade de água passando pelo sistema em determinado intervalo.

### 📦 Volume consumido

Quantidade acumulada de água utilizada.

### 📈 Histórico

Registro do comportamento do consumo ao longo do tempo.

### 💰 Custo estimado

Conversão do consumo de água em uma estimativa financeira, permitindo relacionar diretamente:

```text
Consumo de água
       ↓
Volume utilizado
       ↓
Tarifa considerada
       ↓
Custo estimado
```

Essa abordagem busca tornar o consumo mais tangível para o usuário.

---

## 🚨 Detecção de possíveis desperdícios

Uma das aplicações do monitoramento contínuo é a identificação de comportamentos anormais.

Um exemplo seria a existência de **fluxo contínuo durante um período no qual normalmente não deveria existir consumo**.

```text
Fluxo detectado
      │
      ▼
Duração do fluxo
      │
      ▼
Comparação com padrão
      │
      ├── Normal
      │
      └── Anormal
             │
             ▼
      Possível desperdício
             │
             ▼
      Investigar vazamento
```

O sistema, portanto, não se limita a medir água: os dados podem servir como base para interpretação do comportamento de consumo.

---

## 🏠 Protótipo físico

O HydroCasa também contempla um modelo físico de uma residência para representar a aplicação do sistema.

A estrutura considera:

* Reservatório de água;
* Tubulações;
* Pontos de passagem de água;
* Sensores;
* ESP32;
* Sistema de monitoramento.

### Protótipo

> **Adicionar aqui uma imagem do protótipo final**

Sugestão:

```markdown
![Protótipo HydroCasa](docs/images/prototipo.jpg)
```

---

## 🌱 ODS relacionadas

O projeto está diretamente relacionado aos seguintes **Objetivos de Desenvolvimento Sustentável da ONU**:

### ODS 6 — Água Potável e Saneamento

O projeto busca contribuir para uma utilização mais consciente dos recursos hídricos por meio do monitoramento e da disponibilização de informações sobre o consumo.

### ODS 9 — Indústria, Inovação e Infraestrutura

A utilização de sensores, sistemas embarcados e IoT demonstra uma aplicação tecnológica voltada para um problema cotidiano.

---

## 🔬 Fundamentação

O desenvolvimento do HydroCasa foi baseado em estudos relacionados ao monitoramento inteligente do consumo residencial de água.

Pesquisas anteriores demonstram a viabilidade da utilização de sensores de fluxo, comunicação sem fio e sistemas de monitoramento para acompanhamento do consumo e identificação de situações anormais.

Um dos estudos utilizados como referência apresentou uma rede de sensores sem fio de baixo custo para monitoramento residencial em tempo real, obtendo erro inferior a 5% na estimativa do volume consumido.

Outros trabalhos também exploram sistemas de baixo custo baseados em sensores de fluxo e comunicação Wi-Fi para identificar vazamentos e desvios no consumo.

Além da tecnologia, pesquisas indicam que disponibilizar informações de consumo e alertas ao usuário pode contribuir para mudanças no comportamento de consumo.

---

## 🧪 Validação

A validação do projeto deve verificar se o sistema consegue cumprir os principais objetivos estabelecidos:

* Detectar a passagem de água;
* Registrar o consumo;
* Processar os dados corretamente;
* Apresentar informações compreensíveis;
* Estimar o custo do consumo;
* Identificar comportamentos anormais.

A comparação entre o volume efetivamente utilizado e o volume indicado pelo sistema pode ser utilizada como uma das formas de avaliar a precisão da solução.

---

## 💡 Impacto esperado

O HydroCasa não tem como objetivo substituir o hidrômetro convencional.

A proposta é funcionar como uma **camada complementar de monitoramento, análise e feedback**.

Em vez de o usuário ter acesso apenas a uma informação mensal, o sistema busca aproximá-lo dos próprios dados de consumo.

```text
Conta de água
     │
     │ Informação periódica
     ▼
  Consumo mensal


HydroCasa
     │
     ├── Vazão
     ├── Volume
     ├── Histórico
     ├── Custo estimado
     └── Possíveis anomalias
            │
            ▼
    Feedback ao usuário
```

O objetivo final é transformar **dados de consumo em informação útil para tomada de decisão**.

---

## 🚀 Possíveis evoluções

A arquitetura do projeto permite diversas extensões futuras:

* [ ] Armazenamento histórico permanente;
* [ ] Dashboard de consumo;
* [ ] Aplicativo mobile;
* [ ] Sistema de notificações;
* [ ] Alertas automáticos de vazamento;
* [ ] Definição de metas de consumo;
* [ ] Comparação entre períodos;
* [ ] Monitoramento de diferentes ambientes;
* [ ] Banco de dados remoto;
* [ ] Análise estatística do consumo;
* [ ] Detecção automática de anomalias;
* [ ] Aplicação de Machine Learning para identificação de padrões.

A utilização de dados históricos também abre possibilidade para futuras análises estatísticas e modelos de aprendizado de máquina.

---

## 📚 Referências

**ALVES, Arnon Jadir Rodrigues; MANERA, Leandro Tiago; CAMPOS, Marcel Veloso.** Low-cost wireless sensor network applied to real-time monitoring and control of water consumption in residences. *Revista Ambiente & Água*, 2019.

**MICHELS AMERICO, Gabriel; IZIDORO, Cleber Lourenço.** Sistema de baixo custo para monitoramento do consumo de água. *Revista Vincci*, 2022.

**RUPIPER, Amanda M. et al.** AMI water meters deliver end-use water and financial savings in leaky households: experimental evidence from California. *Environmental Research Letters*, 2024.

**SANTANA, Gabriel Silva et al.** Desenvolvimento e avaliação funcional em ambiente simulado de sistema inteligente de monitoramento e controle de reservatórios de água com ESP32. *Revista da Micro e Pequena Empresa*, 2025.

**WANG, Juan et al.** The impact of smart meter programmes on household water consumption: evidence from New Zealand. *Journal of Behavioral and Experimental Economics*, 2025.

---

## 👥 Equipe

Projeto desenvolvido na **Facens — Centro Universitário Facens**, no contexto da disciplina de **Usina de Projetos Experimentais (UPx)**.

**Líder do projeto:**
Frederico de Medeiros Freitas

**Orientador:**
Prof. Dr. Rodrigo Henrique Geraldo

### Integrantes

* Dyulian Yuji Muramatsu de Faria
* Frederico de Medeiros Freitas
* Gabriel José Vieira Leme Teles
* Jyuan Miyazaki
* Miguel Costa e Souza
* Nicolas Andrade Marinelli
* Ryan Oliveira Leme

---

## 📄 Contexto acadêmico

**Tecnologia e Comportamento na Gestão e Consumo de Água: Desenvolvimento de um Sistema Inteligente de Monitoramento Residencial**

Facens — Sorocaba/SP
2026

---

## 📜 Licença

Projeto desenvolvido para fins acadêmicos e educacionais.
