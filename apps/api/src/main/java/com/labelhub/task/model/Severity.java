package com.labelhub.task.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Severity {
  LOW("low"),
  MEDIUM("medium"),
  HIGH("high"),
  CRITICAL("critical");

  private final String wireValue;

  Severity(String wireValue) {
    this.wireValue = wireValue;
  }

  @JsonValue
  public String wireValue() {
    return wireValue;
  }

  @JsonCreator
  public static Severity fromWireValue(String value) {
    for (Severity severity : values()) {
      if (severity.wireValue.equals(value) || severity.name().equalsIgnoreCase(value)) {
        return severity;
      }
    }
    throw new IllegalArgumentException("Unsupported severity: " + value);
  }
}
