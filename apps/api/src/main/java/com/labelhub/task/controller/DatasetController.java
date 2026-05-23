package com.labelhub.task.controller;

import com.labelhub.task.dto.TaskPackageDtos.DatasetImportPreviewDto;
import com.labelhub.task.service.TaskPackageService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/datasets")
public class DatasetController {
  private final TaskPackageService taskPackageService;

  public DatasetController(TaskPackageService taskPackageService) {
    this.taskPackageService = taskPackageService;
  }

  @PostMapping("/{taskId}/import-preview")
  public DatasetImportPreviewDto previewImport(@PathVariable String taskId) {
    return taskPackageService.previewDatasetImport(taskId);
  }
}
