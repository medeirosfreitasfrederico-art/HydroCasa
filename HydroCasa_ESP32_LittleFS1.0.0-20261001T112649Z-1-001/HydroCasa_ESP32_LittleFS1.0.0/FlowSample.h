#pragma once
#include <stdint.h>

// Independent of HTTP polling; unsigned subtraction handles millis()/pulse wrap.
struct FlowSample {
  uint32_t previousPulses = 0;
  uint32_t previousMs = 0;
  float litersPerMinute = 0;

  void reset(uint32_t now, uint32_t pulses = 0) {
    previousPulses = pulses;
    previousMs = now;
    litersPerMinute = 0;
  }

  void update(uint32_t now, uint32_t pulses, float pulsesPerLiter) {
    const uint32_t elapsed = now - previousMs;
    if (elapsed < 1000) return;
    const uint32_t delta = pulses - previousPulses;
    litersPerMinute = pulsesPerLiter > 0
      ? (static_cast<float>(delta) / pulsesPerLiter) * (60000.0f / elapsed)
      : 0;
    previousPulses = pulses;
    previousMs = now;
  }
};
