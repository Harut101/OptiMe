import { entry, names as n } from './content';

export const mobilityExercises = [
  entry('cat-cow', n('Cat-Cow','Кошка-корова','Chat-vache','猫牛式'), 'MOBILITY','MOBILITY',['BODYWEIGHT'],['LOWER_BACK'],['ABS'],['BEGINNER','INTERMEDIATE','ADVANCED'],['WRIST_LOAD','PREGNANCY_REVIEW']),
  entry('thoracic-rotation', n('Thoracic Rotation','Вращение грудного отдела','Rotation thoracique','胸椎旋转'), 'MOBILITY','ROTATION',['BODYWEIGHT'],['TRAPS','LATS'],['OBLIQUES'],['BEGINNER','INTERMEDIATE','ADVANCED']),
  entry('hip-flexor-stretch', n('Hip Flexor Stretch','Растяжка сгибателей бедра','Étirement des fléchisseurs de hanche','髋屈肌拉伸'), 'MOBILITY','MOBILITY',['BODYWEIGHT'],['QUADRICEPS'],['GLUTES'],['BEGINNER','INTERMEDIATE','ADVANCED'],['KNEE_LOAD','BALANCE_REQUIRED']),
  entry('calf-stretch', n('Calf Stretch','Растяжка икроножных мышц','Étirement des mollets','小腿拉伸'), 'RECOVERY','RECOVERY',['BODYWEIGHT'],['CALVES'],[],['BEGINNER','INTERMEDIATE','ADVANCED'],['BALANCE_REQUIRED']),
  entry('childs-pose', n("Child's Pose",'Поза ребёнка','Posture de l’enfant','婴儿式'), 'RECOVERY','RECOVERY',['BODYWEIGHT'],['LOWER_BACK','LATS'],['SHOULDERS'],['BEGINNER','INTERMEDIATE','ADVANCED'],['KNEE_LOAD','PREGNANCY_REVIEW'])
];
