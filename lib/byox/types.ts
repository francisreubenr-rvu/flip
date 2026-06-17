export interface Tutorial {
  id: string
  category: string
  language: string
  title: string
  url: string
  hasVideo: boolean
  hasPdf: boolean
}

export type ProgressStatus = 'todo' | 'in_progress' | 'done'

export interface TutorialProgress {
  tutorialId: string
  status: ProgressStatus
  notes: string
  updatedAt: string
}

export interface TutorialWithProgress extends Tutorial {
  status: ProgressStatus
  notes: string
}
