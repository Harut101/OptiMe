import { entry, names as n } from './content';

export const coreExercises = [
  entry('dead-bug', n('Dead Bug','Мёртвый жук','Dead bug','死虫式'), 'STRENGTH','CORE_STABILITY',['BODYWEIGHT'],['ABS'],['OBLIQUES'],['BEGINNER','INTERMEDIATE'],['SUPINE_POSITION','PREGNANCY_REVIEW']),
  entry('bird-dog', n('Bird Dog','Птица-собака','Bird dog','鸟狗式'), 'STRENGTH','CORE_STABILITY',['BODYWEIGHT'],['ABS','LOWER_BACK'],['GLUTES'],['BEGINNER','INTERMEDIATE'],['WRIST_LOAD','BALANCE_REQUIRED']),
  entry('front-plank', n('Front Plank','Планка','Planche ventrale','平板支撑'), 'STRENGTH','CORE_STABILITY',['BODYWEIGHT'],['ABS'],['OBLIQUES','SHOULDERS'],['BEGINNER','INTERMEDIATE','ADVANCED'],['WRIST_LOAD','SHOULDER_LOAD','PRONE_POSITION']),
  entry('side-plank', n('Side Plank','Боковая планка','Planche latérale','侧平板支撑'), 'STRENGTH','CORE_STABILITY',['BODYWEIGHT'],['OBLIQUES'],['SHOULDERS','GLUTES'],['INTERMEDIATE','ADVANCED'],['WRIST_LOAD','SHOULDER_LOAD','BALANCE_REQUIRED']),
  entry('pallof-press', n('Pallof Press','Жим Паллофа','Presse Pallof','帕洛夫推'), 'STRENGTH','ANTI_ROTATION',['CABLE_MACHINE'],['OBLIQUES','ABS'],['SHOULDERS'],['BEGINNER','INTERMEDIATE','ADVANCED'],['BALANCE_REQUIRED']),
  entry('glute-bridge-march', n('Glute Bridge March','Ягодичный мост с шагами','Pont fessier alterné','臀桥交替抬腿'), 'STRENGTH','CORE_STABILITY',['BODYWEIGHT'],['GLUTES','ABS'],['HAMSTRINGS'],['INTERMEDIATE','ADVANCED'],['SUPINE_POSITION','PREGNANCY_REVIEW'])
];
