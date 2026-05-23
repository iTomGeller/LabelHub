package com.labelhub.task.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum SchemaComponentType {
  SHORT_TEXT("shortText"),
  LONG_TEXT("longText"),
  SINGLE_CHOICE("singleChoice"),
  MULTI_CHOICE("multiChoice"),
  TAG_SELECT("tagSelect"),
  RICH_TEXT("richText"),
  FILE_UPLOAD("fileUpload"),
  JSON_EDITOR("jsonEditor"),
  LLM_INTERACTION("llmInteraction"),
  SHOW_ITEM("showItem");

  private final String wireValue;

  SchemaComponentType(String wireValue) {
    this.wireValue = wireValue;
  }

  @JsonValue
  public String wireValue() {
    return wireValue;
  }

  @JsonCreator
  public static SchemaComponentType fromWireValue(String value) {
    for (SchemaComponentType type : values()) {
      if (type.wireValue.equals(value) || type.name().equalsIgnoreCase(value)) {
        return type;
      }
    }
    throw new IllegalArgumentException("Unsupported schema component type: " + value);
  }
}
