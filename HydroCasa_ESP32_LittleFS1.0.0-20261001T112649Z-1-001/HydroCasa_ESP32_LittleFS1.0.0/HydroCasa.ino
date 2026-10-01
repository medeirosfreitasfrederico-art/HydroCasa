/*
  Casa Inteligente - Monitoramento de Vazão
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

const char* WIFI_SSID = "SEU_WIFI";
const char* WIFI_PASS = "SUA_SENHA";

#define FLOW1_PIN 25
#define FLOW2_PIN 26

// YF-S201 costuma ser usado com ~450 pulsos/L como ponto inicial.
// Faça a calibração real e altere este valor se necessário.
volatile uint32_t pulses1 = 0;
volatile uint32_t pulses2 = 0;

const float PULSES_PER_LITER_1 = 450.0f;
const float PULSES_PER_LITER_2 = 450.0f;

WebServer server(80);

portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

uint32_t readPulses1() {
  uint32_t p;
  portENTER_CRITICAL(&mux);
  p = pulses1;
  portEXIT_CRITICAL(&mux);
  return p;
}

uint32_t readPulses2() {
  uint32_t p;
  portENTER_CRITICAL(&mux);
  p = pulses2;
  portEXIT_CRITICAL(&mux);
  return p;
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

void appendDailySnapshot(const String& dateKey, float liters1, float liters2) {
  // Formato simples e robusto para uma maquete:
  // /daily.csv -> YYYY-MM-DD;litros_sensor_1;litros_sensor_2
  File f = LittleFS.open("/daily.csv", FILE_APPEND);
  if (!f) return;

  // O frontend envia o valor acumulado do ESP no instante da sincronização.
  // A linha é um snapshot; o site usa a diferença entre snapshots do mesmo dia.
  f.print(dateKey);
  f.print(";");
  f.print(liters1, 4);
  f.print(";");
  f.println(liters2, 4);
  f.close();
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

  appendDailySnapshot(dateKey, l1.toFloat(), l2.toFloat());
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
  uint32_t p1 = readPulses1();
  uint32_t p2 = readPulses2();

  float liters1 = p1 / PULSES_PER_LITER_1;
  float liters2 = p2 / PULSES_PER_LITER_2;

  String json = "{";
  json += "\"ok\":true,";
  json += "\"uptime_ms\":" + String(millis()) + ",";
  json += "\"pulses1\":" + String(p1) + ",";
  json += "\"pulses2\":" + String(p2) + ",";
  json += "\"liters1\":" + String(liters1, 4) + ",";
  json += "\"liters2\":" + String(liters2, 4) + ",";
  json += "\"flow1_lpm\":" + String((float)p1 / PULSES_PER_LITER_1, 4) + ",";
  json += "\"flow2_lpm\":" + String((float)p2 / PULSES_PER_LITER_2, 4);
  json += "}";

  server.send(200, "application/json", json);
}

void handleReset() {
  portENTER_CRITICAL(&mux);
  pulses1 = 0;
  pulses2 = 0;
  portEXIT_CRITICAL(&mux);

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

  attachInterrupt(digitalPinToInterrupt(FLOW1_PIN), flow1ISR, RISING);
  attachInterrupt(digitalPinToInterrupt(FLOW2_PIN), flow2ISR, RISING);

  if (!LittleFS.begin(true)) {
    Serial.println("ERRO: LittleFS nao inicializou.");
  } else {
    Serial.println("LittleFS OK.");
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

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

  server.on("/api/live", HTTP_GET, handleLive);
  server.on("/api/config", HTTP_GET, handleConfig);
  server.on("/api/daily", HTTP_POST, handleDaily);
  server.on("/api/daily.csv", HTTP_GET, handleDailyFile);
  server.on("/api/reset", HTTP_POST, handleReset);

  // LittleFS serve todos os arquivos da pasta data/
  server.serveStatic("/", LittleFS, "/index.html");
  server.serveStatic("/index.html", LittleFS, "/index.html");
  server.serveStatic("/style.css", LittleFS, "/style.css");
  server.serveStatic("/app.js", LittleFS, "/app.js");

  server.onNotFound([]() {
    server.send(404, "text/plain", "404 - recurso nao encontrado");
  });

  server.begin();
  Serial.println("Servidor HTTP iniciado.");
}

void loop() {
  server.handleClient();
}
