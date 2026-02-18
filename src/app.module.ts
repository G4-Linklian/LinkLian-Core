import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InstitutionModule } from './modules/institution/institution.module';
import { RoleModule } from './modules/role/role.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { BuildingModule } from './modules/building/building.module';
import { RoomLocationModule } from './modules/room-location/room-location.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { EduLevelModule } from './modules/edu-level/edu-level.module';
import { LearningAreaModule } from './modules/learning-area/learning-area.module';
import { ProgramModule } from './modules/program/program.module';
import { SectionModule } from './modules/section/section.module';
import { SemesterModule } from './modules/semester/semester.module';
import { SubjectModule } from './modules/subject/subject.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SocialFeedModule } from './modules/social-feed/social-feed.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { RegisSummaryModule } from "./modules/summary/registration/regis.summary.module";
import { ImportStudentModule } from './modules/import-csv/student/import-student.module';
import { ImportSubjectModule } from './modules/import-csv/subject/import-subject.module';
import { ImportTeacherModule } from './modules/import-csv/teacher/import-teacher.module';
import { ImportProgramModule } from './modules/import-csv/program/import-program.module';
import { ImportSectionScheduleModule } from './modules/import-csv/section-schedule/import-section-schdule.module';
import { ImportEnrollmentModule } from './modules/import-csv/enrollment/import-enrollment.module';
import { CommunityModule } from './modules/community/community.module';

@Module({
  imports: [

    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST,
      port: parseInt(String(process.env.PG_PORT), 10),
      username: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      autoLoadEntities: true,
      synchronize: false, // True เฉพาะ Dev Mode (สร้าง Table อัตโนมัติ)
      ssl: true,
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    }),
    AuthModule,
    InstitutionModule,
    RoleModule,
    AdminModule,
    ChatModule,
    BuildingModule,
    RoomLocationModule,
    FileStorageModule,
    EduLevelModule,
    LearningAreaModule,
    ProgramModule,
    SectionModule,
    SemesterModule,
    SubjectModule,
    UsersModule,
    ProfileModule,
    SocialFeedModule,
    AssignmentModule,       // ✅ เพิ่ม AssignmentModule
    BookmarkModule,
    RegisSummaryModule,
    ImportStudentModule,
    ImportSubjectModule,
    ImportTeacherModule,
    ImportProgramModule,
    ImportSectionScheduleModule,
    ImportEnrollmentModule
    CommunityModule,
  ],

  controllers: [AppController],
  providers: [AppService],

})
export class AppModule { }
