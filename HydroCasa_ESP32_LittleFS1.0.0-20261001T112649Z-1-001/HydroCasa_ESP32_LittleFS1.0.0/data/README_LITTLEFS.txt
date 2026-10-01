LITTLEFS — GUIA RÁPIDO

A pasta `data/` precisa ser enviada ao sistema LittleFS do ESP32.

Arquivos:
- index.html
- style.css
- app.js

No Arduino IDE, utilize o método de upload LittleFS compatível com a versão do core ESP32 instalada.

Depois de carregar:
1. Abra o Serial Monitor.
2. Veja o IP do ESP32.
3. Acesse http://IP_DO_ESP32/ no navegador.

Se o site abrir mas os sensores não atualizarem:
- confira o Wi-Fi;
- confira os GPIOs;
- confira a alimentação;
- confira a tensão do sinal;
- confira a calibração do sensor.

Se usar outro sensor além do YF-S201, altere o fator de pulsos por litro no `.ino`.
