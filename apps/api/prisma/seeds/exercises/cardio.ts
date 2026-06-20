import { entry, names as n } from './content';

export const cardioExercises = [
  entry('walking', n('Walking','Ходьба','Marche','步行'), 'CARDIO','CARDIO',['NONE'],['FULL_BODY'],[],['BEGINNER','INTERMEDIATE','ADVANCED'],['BALANCE_REQUIRED']),
  entry('stationary-bike', n('Stationary Bike','Велотренажёр','Vélo d’appartement','健身车'), 'CARDIO','CARDIO',['CARDIO_MACHINE'],['QUADRICEPS'],['HAMSTRINGS','GLUTES'],['BEGINNER','INTERMEDIATE','ADVANCED'],['KNEE_LOAD']),
  entry('elliptical', n('Elliptical','Эллиптический тренажёр','Vélo elliptique','椭圆机'), 'CARDIO','CARDIO',['CARDIO_MACHINE'],['QUADRICEPS','GLUTES'],['HAMSTRINGS','CALVES'],['BEGINNER','INTERMEDIATE','ADVANCED'],['BALANCE_REQUIRED'])
];
