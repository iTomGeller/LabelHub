package com.labelhub.task.service;

import com.labelhub.task.dto.SchemaDtos.AnnotationSchemaDto;
import com.labelhub.task.dto.SchemaDtos.SchemaComponentDto;
import com.labelhub.task.model.SchemaComponentType;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class SchemaValidator {
  private static final int REQUIRED_COMPONENT_TYPES = 10;
  private static final Set<String> ALLOWED_VALIDATION_TYPES = Set.of(
      "required",
      "minLength",
      "maxLength",
      "regex",
      "custom"
  );

  public List<String> validate(AnnotationSchemaDto schema) {
    List<String> errors = new ArrayList<>();
    Set<String> ids = new HashSet<>();
    Set<SchemaComponentType> types = new HashSet<>();

    for (SchemaComponentDto component : schema.components()) {
      if (!ids.add(component.id())) {
        errors.add("Duplicate component id: " + component.id());
      }
      if (!component.dataPath().startsWith("$.")) {
        errors.add("Component " + component.id() + " dataPath must start with '$.'");
      }
      if (component.required() && (component.validation() == null || component.validation().isEmpty())) {
        errors.add("Required component " + component.id() + " must define validation rules");
      }
      if (component.validation() != null) {
        component.validation().stream()
            .filter(rule -> !ALLOWED_VALIDATION_TYPES.contains(rule.type()))
            .forEach(rule -> errors.add("Component " + component.id() + " has unsupported validation type: " + rule.type()));
      }
      types.add(component.type());
    }

    if (types.size() < REQUIRED_COMPONENT_TYPES) {
      errors.add("Schema should cover all " + REQUIRED_COMPONENT_TYPES + " required component types before final acceptance");
    }
    EnumSet.allOf(SchemaComponentType.class).stream()
        .filter(type -> !types.contains(type))
        .findFirst()
        .ifPresent(type -> errors.add("Missing required component type: " + type.name()));

    return errors;
  }

  public boolean isValidForPublish(AnnotationSchemaDto schema) {
    return validate(schema).isEmpty();
  }
}
