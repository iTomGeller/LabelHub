export interface MockTask {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  completedItems: number;
  deadline: string;
  status: 'draft' | 'publishing' | 'paused' | 'ended';
  displayStatus: string;
  currentStep: number;
  totalSteps: number;
  updatedAt: string;
  stepName: string;
  progress: number;
}

export const mockTasks: MockTask[] = [
  {
    id: 'task_text_cls_001',
    name: '情感分类标注',
    description: '对用户评论进行正面/负面情感标注',
    totalItems: 100,
    completedItems: 45,
    deadline: '2026-06-15',
    status: 'publishing',
    displayStatus: '进行中',
    currentStep: 4,
    totalSteps: 4,
    updatedAt: '2026-05-21 14:32',
    stepName: '完成',
    progress: 45
  },
  {
    id: 'task_ner_002',
    name: '实体识别',
    description: '抽取文本中的人物、地点、组织机构实体',
    totalItems: 200,
    completedItems: 120,
    deadline: '2026-06-15',
    status: 'publishing',
    displayStatus: '待领取',
    currentStep: 4,
    totalSteps: 4,
    updatedAt: '2026-05-20 09:15',
    stepName: '确认发布',
    progress: 60
  },
  {
    id: 'task_qa_003',
    name: '问答对质量评估',
    description: '对用户生成的问答对进行质量审核',
    totalItems: 150,
    completedItems: 0,
    deadline: '2026-05-30',
    status: 'draft',
    displayStatus: '草稿',
    currentStep: 1,
    totalSteps: 4,
    updatedAt: '2026-05-19 16:40',
    stepName: '数据上传',
    progress: 0
  },
  {
    id: 'task_seg_004',
    name: '图片语义分割',
    description: '对自动驾驶场景图片进行像素级分割标注',
    totalItems: 50,
    completedItems: 50,
    deadline: '2026-05-20',
    status: 'publishing',
    displayStatus: '已完成',
    currentStep: 4,
    totalSteps: 4,
    updatedAt: '2026-05-18 11:20',
    stepName: '完成',
    progress: 100
  }
];

const STEP_NAMES = ['数据上传', '配置模板', '质检规则', '确认发布'];

export { STEP_NAMES };
