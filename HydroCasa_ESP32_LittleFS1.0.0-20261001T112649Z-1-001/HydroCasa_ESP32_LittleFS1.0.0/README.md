# HydroCasa — ESP32 + 2 sensores de vazão + LittleFS

Projeto acadêmico de maquete residencial para monitoramento de consumo de água.

## Estrutura

- `HydroCasa.ino` — firmware do ESP32.
- `data/index.html` — painel.
- `data/style.css` — interface responsiva, futurista e tema claro/escuro.
- `data/app.js` — lógica, calendário, gráficos, alertas e contextualização.
- `data/README_LITTLEFS.txt` — instruções rápidas.

## Hardware sugerido

- ESP32 DevKit.
- 2 sensores de vazão Hall (ex.: YF-S201, se compatível com seu projeto).
- Tubos transparentes.
- Fonte/USB para o ESP32.
- MDF e recipiente transparente.

GPIO padrão:
- Sensor 1: GPIO 25
- Sensor 2: GPIO 26

## Atenção elétrica

Confirme a tensão do seu sensor. O ESP32 trabalha com lógica de 3,3 V nos GPIOs. Se o sinal do sensor puder chegar a 5 V, utilize adaptação de nível adequada.

## Calibração

O código começa com 450 pulsos/L para cada sensor como referência. Isso NÃO deve ser tratado como valor universal.

Faça uma calibração:
1. Passe um volume conhecido, por exemplo 1 L.
2. Conte os pulsos.
3. Repita algumas vezes.
4. Use uma média.
5. Altere `PULSES_PER_LITER_1` e `PULSES_PER_LITER_2`.

## Como instalar

1. Abra `HydroCasa.ino` no Arduino IDE.
2. Selecione sua placa ESP32.
3. Instale/configure o core ESP32.
4. Coloque seu SSID e senha no código.
5. Instale a extensão/ferramenta de upload do LittleFS para a sua versão do Arduino IDE.
6. Faça o upload da pasta `data` para o LittleFS.
7. Faça o upload do firmware.
8. Abra o Serial Monitor em 115200 baud.
9. Pegue o IP mostrado pelo ESP32.
10. Acesse o IP no navegador.

## Como o calendário funciona

A data/hora usada pelo painel é a do computador/navegador. O ESP32 não precisa ter RTC para a organização visual do calendário.

A cada atualização:
- o ESP32 envia os pulsos/litros atuais;
- o navegador cria snapshots do dia;
- o navegador organiza os dados por `AAAA-MM-DD`;
- o snapshot também é enviado ao ESP32 e acrescentado em `/daily.csv`.

## Limitação importante

Se o navegador ficar totalmente fechado por muito tempo, ele não consegue registrar os snapshots desse período, porque a data/hora exigida pelo projeto vem do computador. Para uma versão de produção, seria possível adicionar RTC/NTP ao ESP32 e fazer o registro diário diretamente no dispositivo.

## Demonstração

Antes da apresentação:
- zere os contadores;
- deixe o site aberto;
- faça fluxos conhecidos em cada ramal;
- mostre os litros em tempo real;
- abra o Calendário;
- registre uma atividade como "Lavou o carro";
- mostre a diferença entre consumo bruto e contextualizado;
- provoque um fluxo maior para demonstrar o alerta.
