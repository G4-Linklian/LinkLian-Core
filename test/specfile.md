# Run Import CSV
npx jest src/modules/import-csv --no-coverage --verbose

npx jest import-enrollment.service.spec --no-coverage --verbose
npx jest import-program.service.spec --no-coverage --verbose
npx jest import-student.service.spec --no-coverage --verbose
npx jest import-teacher.service.spec --no-coverage --verbose
npx jest import-subject.service.spec --no-coverage --verbose
npx jest import-section-schedule.service.spec --no-coverage --verbose