#include <cassert>
#include <cmath>
#include "../HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001/HydroCasa_ESP32_LittleFS1.0.0/FlowSample.h"
int main() {
  FlowSample f;
  f.reset(0);
  f.update(60000, 450, 450);
  assert(std::fabs(f.litersPerMinute - 1.0f) < 0.0001f);
  f.update(62500, 900, 450); // actual interval, not assumed one second
  assert(std::fabs(f.litersPerMinute - 24.0f) < 0.0001f);
  f.update(63000, 900, 450); // below sampling period
  assert(std::fabs(f.litersPerMinute - 24.0f) < 0.0001f);
  f.update(63500, 900, 450);
  assert(f.litersPerMinute == 0);
  f.reset(64000);
  f.update(65000, 45, 450);
  assert(std::fabs(f.litersPerMinute - 6.0f) < 0.0001f);
  f.reset(UINT32_MAX - 499, UINT32_MAX - 44);
  f.update(500, 0, 450); // clock and pulse counter wrap
  assert(std::fabs(f.litersPerMinute - 6.0f) < 0.0001f);
  f.update(1500, 45, 0);
  assert(f.litersPerMinute == 0);
}
