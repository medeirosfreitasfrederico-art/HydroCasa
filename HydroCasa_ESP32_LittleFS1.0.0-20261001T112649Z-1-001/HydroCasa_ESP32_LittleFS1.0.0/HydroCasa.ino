/*
  Casa Inteligente (HydroCasa) - Monitoramento de Vazão
  ESP32 + 2 sensores de vazão Hall + LittleFS + WebServer

  SENSOR PADRÃO (exemplo): YF-S201
  - VCC -> 5V
  - GND -> GND
  - SINAL sensor 1 -> GPIO 25
  - SINAL sensor 2 -> GPIO 26

  ATENÇÃO:
  1) Confirme o modelo/calibração dos seus sensores antes da apresentação.
  2) Nunca ligue uma saída de 5 V diretamente a um GPIO do ESP32.
  3) O fator de calibração PULSES_PER_LITER é configurável.
*/

#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <ESPmDNS.h>
#include <esp_system.h>
#include "FlowSample.h"

const char* WIFI_SSID = "Carlinho";
const char* WIFI_PASS = "33d7972ef0";

#define FLOW1_PIN 25
#define FLOW2_PIN 26

// YF-S201 costuma ser usado com ~450 pulsos/L como ponto inicial.
// Faça a calibração real e altere este valor se necessário.
volatile uint32_t pulses1 = 0;
volatile uint32_t pulses2 = 0;

const float TEST_MULTIPLIER = 150.0f;

const float PULSES_PER_LITER_1 = 450.0f / TEST_MULTIPLIER;
const float PULSES_PER_LITER_2 = 450.0f / TEST_MULTIPLIER;

WebServer server(80);

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

String bootId;
uint32_t resetGeneration = 0;

String countingSession() {
  return bootId + "-" + String(resetGeneration);
}

FlowSample flow1;
FlowSample flow2;

void readPulses(uint32_t& p1, uint32_t& p2) {
  portENTER_CRITICAL(&mux);
  p1 = pulses1;
  p2 = pulses2;
  portEXIT_CRITICAL(&mux);
}

void updateFlows() {
  uint32_t p1, p2;
  readPulses(p1, p2);
  const uint32_t now = millis();
  flow1.update(now, p1, PULSES_PER_LITER_1);
  flow2.update(now, p2, PULSES_PER_LITER_2);
}

void IRAM_ATTR flow1ISR() {
  portENTER_CRITICAL_ISR(&mux);
  pulses1++;
  portEXIT_CRITICAL_ISR(&mux);
}

void IRAM_ATTR flow2ISR() {
  portENTER_CRITICAL_ISR(&mux);
  pulses2++;
  portEXIT_CRITICAL_ISR(&mux);
}

String jsonEscape(const String& input) {
  String out;
  for (size_t i = 0; i < input.length(); i++) {
    char c = input[i];
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else {
      out += c;
    }
  }
  return out;
}

String getArg(const String& body, const String& key) {
  String needle = "\"" + key + "\"";
  int k = body.indexOf(needle);
  if (k < 0) return "";
  int colon = body.indexOf(':', k + needle.length());
  if (colon < 0) return "";
  int start = colon + 1;
  while (start < (int)body.length() && (body[start] == ' ' || body[start] == '\t')) start++;

  if (start < (int)body.length() && body[start] == '"') {
    start++;
    int end = body.indexOf('"', start);
    if (end < 0) return "";
    return body.substring(start, end);
  }

  int end = start;
  while (end < (int)body.length() && body[end] != ',' && body[end] != '}') end++;
  String value = body.substring(start, end);
  value.trim();
  return value;
}

bool appendDailySnapshot(const String& dateKey, float liters1, float liters2) {
  File f = LittleFS.open("/daily.csv", FILE_APPEND);
  if (!f) return false;
  const String line = dateKey + ";" + String(liters1, 4) + ";" + String(liters2, 4) + "\n";
  const bool written = f.print(line) == line.length();
  f.close();
  return written;
}

void handleDaily() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"body ausente\"}");
    return;
  }

  String body = server.arg("plain");
  String dateKey = getArg(body, "date");
  String l1 = getArg(body, "liters1");
  String l2 = getArg(body, "liters2");

  if (dateKey.length() != 10 || l1.length() == 0 || l2.length() == 0) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"payload invalido\"}");
    return;
  }

  if (!appendDailySnapshot(dateKey, l1.toFloat(), l2.toFloat())) {
    server.send(500, "application/json", "{\"ok\":false,\"error\":\"falha ao gravar snapshot\"}");
    return;
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleDailyFile() {
  if (!LittleFS.exists("/daily.csv")) {
    server.send(200, "text/plain", "");
    return;
  }

  File f = LittleFS.open("/daily.csv", FILE_READ);
  if (!f) {
    server.send(500, "text/plain", "erro");
    return;
  }

  server.streamFile(f, "text/plain");
  f.close();
}

void handleLive() {
  uint32_t p1, p2;
  readPulses(p1, p2);

  float liters1 = p1 / PULSES_PER_LITER_1;
  float liters2 = p2 / PULSES_PER_LITER_2;

  String json = "{";
  json += "\"ok\":true,";
  json += "\"device_id\":\"" + WiFi.macAddress() + "\",";
  json += "\"session_id\":\"" + countingSession() + "\",";
  json += "\"uptime_ms\":" + String(millis()) + ",";
  json += "\"pulses1\":" + String(p1) + ",";
  json += "\"pulses2\":" + String(p2) + ",";
  json += "\"liters1\":" + String(liters1, 4) + ",";
  json += "\"liters2\":" + String(liters2, 4) + ",";
  json += "\"flow1_lpm\":" + String(flow1.litersPerMinute, 4) + ",";
  json += "\"flow2_lpm\":" + String(flow2.litersPerMinute, 4);
  json += "}";

  server.send(200, "application/json", json);
}

void handleReset() {
  portENTER_CRITICAL(&mux);
  pulses1 = 0;
  pulses2 = 0;
  portEXIT_CRITICAL(&mux);
  flow1.reset(millis());
  flow2.reset(millis());
  resetGeneration++;

  server.send(200, "application/json", "{\"ok\":true,\"message\":\"contadores zerados\"}");
}

void handleConfig() {
  String json = "{";
  json += "\"sensor1_pulses_per_liter\":" + String(PULSES_PER_LITER_1, 2) + ",";
  json += "\"sensor2_pulses_per_liter\":" + String(PULSES_PER_LITER_2, 2) + ",";
  json += "\"sensor1_pin\":" + String(FLOW1_PIN) + ",";
  json += "\"sensor2_pin\":" + String(FLOW2_PIN);
  json += "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(FLOW1_PIN, INPUT_PULLUP);
  pinMode(FLOW2_PIN, INPUT_PULLUP);

  flow1.reset(millis());
  flow2.reset(millis());

  attachInterrupt(digitalPinToInterrupt(FLOW1_PIN), flow1ISR, RISING);
  attachInterrupt(digitalPinToInterrupt(FLOW2_PIN), flow2ISR, RISING);

  if (!LittleFS.begin(true)) {
    Serial.println("ERRO: LittleFS nao inicializou.");
  } else {
    Serial.println("LittleFS OK.");
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  bootId = String(esp_random(), HEX) + "-" + String(esp_random(), HEX);

  Serial.print("Conectando ao Wi-Fi");
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi nao conectado. O site ainda pode ser usado localmente se a rede for corrigida.");
  }

  if (!MDNS.begin("hydrocasa")) {
  Serial.println("Erro ao iniciar o mDNS!");
  } else {
  Serial.println("mDNS iniciado! Pode aceder a http://hydrocasa.local");
  }

  server.on("/api/live", HTTP_GET, handleLive);
  server.on("/api/config", HTTP_GET, handleConfig);
  server.on("/api/daily", HTTP_POST, handleDaily);
  server.on("/api/daily.csv", HTTP_GET, handleDailyFile);
  server.on("/api/reset", HTTP_POST, handleReset);

  // LittleFS serve todos os arquivos da pasta data/
  server.serveStatic("/", LittleFS, "/index.html");
  server.serveStatic("/index.html", LittleFS, "/index.html");
  server.serveStatic("/simulador.html", LittleFS, "/simulador.html");
  server.serveStatic("/style.css", LittleFS, "/style.css");
  server.serveStatic("/app.js", LittleFS, "/app.js");
  server.serveStatic("/consumption.js", LittleFS, "/consumption.js");
  server.serveStatic("/hydrocasa-symbol.png", LittleFS, "/hydrocasa-symbol.png");
  server.serveStatic("/hydrocasa-logo.jpeg", LittleFS, "/hydrocasa-logo.jpeg");
  server.serveStatic("/hero.css", LittleFS, "/hero.css");
  server.serveStatic("/mobile.css", LittleFS, "/mobile.css");
  server.serveStatic("/tour.css", LittleFS, "/tour.css");
  server.serveStatic("/tour.js", LittleFS, "/tour.js");
  server.serveStatic("/alertas.js", LittleFS, "/alertas.js");
  server.serveStatic("/alertas-ui.js", LittleFS, "/alertas-ui.js");
  server.serveStatic("/alertas.css", LittleFS, "/alertas.css");
  server.serveStatic("/dashboard-ux.js", LittleFS, "/dashboard-ux.js");
  server.serveStatic("/dashboard-ux.css", LittleFS, "/dashboard-ux.css");
  server.serveStatic("/system-improvements.css", LittleFS, "/system-improvements.css");
  server.serveStatic("/demo-overlay.css", LittleFS, "/demo-overlay.css");
  server.serveStatic("/demo-overlay.js", LittleFS, "/demo-overlay.js");
  server.serveStatic("/hydrocasa-og.svg", LittleFS, "/hydrocasa-og.svg");
  server.serveStatic("/icon-alerta.svg", LittleFS, "/icon-alerta.svg");
  server.serveStatic("/icon-perfil.svg", LittleFS, "/icon-perfil.svg");
  server.serveStatic("/visual-fixtures-temporary.css", LittleFS, "/visual-fixtures-temporary.css");
  server.serveStatic("/visual-fixtures-temporary.js", LittleFS, "/visual-fixtures-temporary.js");
  server.serveStatic("/consumption-status.css", LittleFS, "/consumption-status.css");
  server.serveStatic("/consumption-status.js", LittleFS, "/consumption-status.js");
  server.serveStatic("/alertas-config.js", LittleFS, "/alertas-config.js");

  server.onNotFound([]() {
    server.send(404, "text/plain", "404 - recurso nao encontrado");
  });

  server.begin();
  Serial.println("Servidor HTTP iniciado.");
}

void loop() {
  updateFlows();
  server.handleClient();
}
