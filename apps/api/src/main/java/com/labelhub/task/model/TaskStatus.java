package com.labelhub.task.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum TaskStatus {
  DRAFT("draft"),
  PUBLISHING("publishing"),
  PAUSED("paused"),
  ENDED("ended");

  private final String wireValue;

  TaskStatus(String wireValue) {
    this.wireValue = wireValue;
  }

  @JsonValue
  public String wireValue() {
    return wireValue;
  }

  @JsonCreator
  public static TaskStatus fromWireValue(String value) {
    for (TaskStatus status : values()) {
      if (status.wireValue.equals(value) || status.name().equalsIgnoreCase(value)) {
        return status;
      }
    }
    throw new IllegalArgumentException("Unsupported task status: " + value);
  }
}
