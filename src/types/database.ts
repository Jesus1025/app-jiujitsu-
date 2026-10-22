// Tipos de la base de datos con el mismo formato que `supabase gen types typescript`.
// Escritos a mano a partir de supabase/migrations. El CI los regenera desde la base real
// y vuelve a compilar la app con ellos; localmente: `npm run db:types`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type MemberRole = 'owner' | 'instructor' | 'student' | 'guardian';
type MembershipStatus = 'pending' | 'active' | 'rejected' | 'inactive';
type BeltTrack = 'adult' | 'kids';
type StudentStatus = 'pending' | 'active' | 'inactive';
type ChargeStatus = 'pending' | 'paid' | 'void';

/** Insert: las columnas en Req son obligatorias; el resto, opcionales. */
type Def<Row, Req extends keyof Row, Rel extends unknown[] = []> = {
  Row: Row;
  Insert: { [K in Req]: Row[K] } & { [K in Exclude<keyof Row, Req>]?: Row[K] };
  Update: { [K in keyof Row]?: Row[K] };
  Relationships: Rel;
};

/** Las columnas de las vistas siempre pueden ser null para PostgREST. */
type ViewDef<Row> = {
  Row: { [K in keyof Row]: Row[K] | null };
  Relationships: [];
};

type AcademyRow = {
  id: string;
  name: string;
  join_code: string;
  logo_path: string | null;
  primary_color: string | null;
  timezone: string;
  currency: string;
  plan: string;
  settings: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  late_tolerance_minutes: number;
  checkin_code: string;
  public_slug: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};

type MembershipRow = {
  id: string;
  academy_id: string;
  user_id: string;
  role: MemberRole;
  status: MembershipStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  academy_id: string;
  name: string;
  min_age: number;
  max_age: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type BeltRow = {
  id: string;
  academy_id: string;
  track: BeltTrack;
  name: string;
  color_hex: string;
  stripe_color_hex: string | null;
  max_degrees: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type FeePlanRow = {
  id: string;
  academy_id: string;
  name: string;
  amount: number;
  billing_day: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type StudentRow = {
  id: string;
  academy_id: string;
  user_id: string | null;
  guardian_user_id: string | null;
  first_name: string;
  last_name: string;
  rut: string | null;
  birth_date: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  photo_path: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  prior_experience: string | null;
  joined_at: string;
  status: StudentStatus;
  left_at: string | null;
  left_reason: string | null;
  fee_plan_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type WaiverTemplateRow = {
  id: string;
  academy_id: string;
  version: number;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

type WaiverSignatureRow = {
  id: string;
  academy_id: string;
  student_id: string;
  template_id: string;
  signer_name: string;
  signer_rut: string | null;
  signer_relationship: string;
  signature_svg: string;
  signed_by: string | null;
  signed_at: string;
};

type RankAwardRow = {
  id: string;
  academy_id: string;
  student_id: string;
  belt_id: string;
  degree: number;
  awarded_at: string;
  awarded_by: string | null;
  notes: string | null;
  created_at: string;
};

type ClassScheduleRow = {
  id: string;
  academy_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  title: string;
  category_id: string | null;
  instructor_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ClassSessionRow = {
  id: string;
  academy_id: string;
  schedule_id: string | null;
  date: string;
  starts_at: string;
  ends_at: string;
  title: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  academy_id: string;
  session_id: string;
  student_id: string;
  checked_in_at: string;
  method: string;
  is_late: boolean;
  recorded_by: string | null;
};

type ChargeRow = {
  id: string;
  academy_id: string;
  student_id: string;
  concept: string;
  period: string | null;
  description: string | null;
  amount: number;
  discount: number;
  due_date: string;
  status: ChargeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  academy_id: string;
  charge_id: string;
  student_id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string | null;
  recorded_by: string | null;
  created_at: string;
};

type DiscountRow = {
  id: string;
  academy_id: string;
  student_id: string;
  percent: number;
  reason: string;
  used_charge_id: string | null;
  created_by: string | null;
  created_at: string;
};

type ReferralRow = {
  id: string;
  academy_id: string;
  referrer_student_id: string;
  referred_student_id: string;
  discount_id: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  academy_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Json;
  created_at: string;
  read_at: string | null;
  push_sent_at: string | null;
};

type PushTokenRow = {
  token: string;
  user_id: string;
  platform: string | null;
  updated_at: string;
};

type GraduationRequirementRow = {
  id: string;
  academy_id: string;
  belt_id: string;
  degree: number;
  min_classes: number;
  min_months: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  academy_id: string;
  type: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  price: number;
  weekly_reminder: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type EventRegistrationRow = {
  id: string;
  academy_id: string;
  event_id: string;
  student_id: string;
  charge_id: string | null;
  created_at: string;
};

type AnnouncementRow = {
  id: string;
  academy_id: string;
  kind: string;
  title: string;
  body: string;
  video_url: string | null;
  pinned: boolean;
  show_on_website: boolean;
  published_at: string;
  created_by: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  academy_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
};

type QuizRow = {
  id: string;
  academy_id: string;
  title: string;
  description: string | null;
  auto_send_after_months: number | null;
  created_by: string | null;
  created_at: string;
};

type QuizQuestionRow = {
  id: string;
  academy_id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  options: Json;
};

type QuizAnswerKeyRow = {
  question_id: string;
  academy_id: string;
  correct_index: number;
};

type QuizAssignmentRow = {
  id: string;
  academy_id: string;
  quiz_id: string;
  student_id: string;
  assigned_at: string;
  answers: Json | null;
  correct_count: number | null;
  question_count: number | null;
  grade: number | null;
  submitted_at: string | null;
};

type PostRow = {
  id: string;
  academy_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  academy_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductSaleRow = {
  id: string;
  academy_id: string;
  product_id: string;
  student_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  charge_id: string | null;
  sold_by: string | null;
  sold_at: string;
};

type CourseRow = {
  id: string;
  academy_id: string;
  title: string;
  description: string | null;
  price: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type CourseLessonRow = {
  id: string;
  academy_id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  video_url: string;
};

type CourseAccessRow = {
  id: string;
  academy_id: string;
  course_id: string;
  student_id: string;
  charge_id: string | null;
  granted_at: string;
};

export type Database = {
  public: {
    Tables: {
      academies: Def<AcademyRow, 'name'>;
      profiles: Def<ProfileRow, 'id'>;
      memberships: Def<
        MembershipRow,
        'academy_id' | 'user_id' | 'role',
        [
          {
            foreignKeyName: 'memberships_academy_id_fkey';
            columns: ['academy_id'];
            isOneToOne: false;
            referencedRelation: 'academies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      categories: Def<CategoryRow, 'academy_id' | 'name' | 'min_age'>;
      belts: Def<BeltRow, 'academy_id' | 'track' | 'name' | 'color_hex' | 'sort_order'>;
      fee_plans: Def<FeePlanRow, 'academy_id' | 'name' | 'amount'>;
      students: Def<StudentRow, 'academy_id' | 'first_name' | 'last_name' | 'birth_date'>;
      waiver_templates: Def<WaiverTemplateRow, 'academy_id' | 'title' | 'body'>;
      waiver_signatures: Def<
        WaiverSignatureRow,
        | 'academy_id'
        | 'student_id'
        | 'template_id'
        | 'signer_name'
        | 'signer_relationship'
        | 'signature_svg'
      >;
      rank_awards: Def<RankAwardRow, 'academy_id' | 'student_id' | 'belt_id'>;
      class_schedules: Def<
        ClassScheduleRow,
        'academy_id' | 'weekday' | 'start_time' | 'end_time' | 'title'
      >;
      class_sessions: Def<
        ClassSessionRow,
        'academy_id' | 'date' | 'starts_at' | 'ends_at' | 'title'
      >;
      attendance: Def<
        AttendanceRow,
        'academy_id' | 'session_id' | 'student_id',
        [
          {
            foreignKeyName: 'attendance_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'class_sessions';
            referencedColumns: ['id'];
          },
        ]
      >;
      charges: Def<ChargeRow, 'academy_id' | 'student_id' | 'concept' | 'amount'>;
      payments: Def<PaymentRow, 'academy_id' | 'charge_id' | 'student_id' | 'amount'>;
      discounts: Def<DiscountRow, 'academy_id' | 'student_id' | 'percent' | 'reason'>;
      referrals: Def<ReferralRow, 'academy_id' | 'referrer_student_id' | 'referred_student_id'>;
      notifications: Def<NotificationRow, 'user_id' | 'type' | 'title'>;
      push_tokens: Def<PushTokenRow, 'token' | 'user_id'>;
      graduation_requirements: Def<GraduationRequirementRow, 'academy_id' | 'belt_id'>;
      events: Def<EventRow, 'academy_id' | 'title' | 'starts_at'>;
      event_registrations: Def<EventRegistrationRow, 'academy_id' | 'event_id' | 'student_id'>;
      announcements: Def<AnnouncementRow, 'academy_id' | 'title'>;
      documents: Def<DocumentRow, 'academy_id' | 'title' | 'file_path' | 'file_name'>;
      quizzes: Def<QuizRow, 'academy_id' | 'title'>;
      quiz_questions: Def<QuizQuestionRow, 'academy_id' | 'quiz_id' | 'prompt' | 'options'>;
      quiz_answer_keys: Def<QuizAnswerKeyRow, 'question_id' | 'academy_id' | 'correct_index'>;
      quiz_assignments: Def<QuizAssignmentRow, 'academy_id' | 'quiz_id' | 'student_id'>;
      posts: Def<PostRow, 'academy_id' | 'body'>;
      products: Def<ProductRow, 'academy_id' | 'name' | 'price'>;
      product_sales: Def<
        ProductSaleRow,
        'academy_id' | 'product_id' | 'quantity' | 'unit_price' | 'total'
      >;
      courses: Def<CourseRow, 'academy_id' | 'title'>;
      course_lessons: Def<CourseLessonRow, 'academy_id' | 'course_id' | 'title' | 'video_url'>;
      course_access: Def<CourseAccessRow, 'academy_id' | 'course_id' | 'student_id'>;
    };
    Views: {
      student_progress: ViewDef<{
        student_id: string;
        academy_id: string;
        belt_id: string;
        degree: number;
        awarded_at: string;
        total_classes: number;
        classes_since_award: number;
        last_class_date: string;
      }>;
      charge_balances: ViewDef<ChargeRow & { paid_amount: number; remaining: number }>;
      student_balances: ViewDef<{
        student_id: string;
        academy_id: string;
        pending_amount: number;
        pending_count: number;
        overdue_months: number;
        oldest_due_date: string;
      }>;
    };
    Functions: {
      create_academy: { Args: { p_name: string }; Returns: AcademyRow };
      join_academy: { Args: { p_code: string; p_role?: MemberRole }; Returns: MembershipRow };
      review_membership: {
        Args: { p_membership: string; p_approve: boolean };
        Returns: MembershipRow;
      };
      regenerate_join_code: { Args: { p_academy: string }; Returns: string };
      set_membership_status: {
        Args: { p_membership: string; p_status: MembershipStatus };
        Returns: MembershipRow;
      };
      link_student_account: { Args: { p_student: string; p_user: string }; Returns: StudentRow };
      rotate_checkin_code: { Args: { p_academy: string }; Returns: string };
      get_checkin_code: { Args: { p_academy: string }; Returns: string };
      ensure_class_session: {
        Args: { p_schedule: string; p_date: string };
        Returns: ClassSessionRow;
      };
      check_in: {
        Args: { p_academy: string; p_code: string; p_student?: string; p_method?: string };
        Returns: AttendanceRow;
      };
      generate_monthly_charges: { Args: { p_academy: string; p_period?: string }; Returns: number };
      register_referral: {
        Args: { p_referrer: string; p_referred: string; p_percent?: number };
        Returns: ReferralRow;
      };
      mark_notifications_read: { Args: Record<PropertyKey, never>; Returns: undefined };
      register_push_token: { Args: { p_token: string; p_platform?: string }; Returns: undefined };
      register_for_event: {
        Args: { p_event: string; p_student: string };
        Returns: EventRegistrationRow;
      };
      attendance_ranking: {
        Args: { p_academy: string; p_from: string; p_to: string; p_limit?: number };
        Returns: { student_id: string; display_name: string; classes: number; rank: number }[];
      };
      academy_dashboard: { Args: { p_academy: string }; Returns: Json };
      public_news: {
        Args: { p_slug: string; p_limit?: number };
        Returns: {
          title: string;
          body: string;
          kind: string;
          published_at: string;
          pinned: boolean;
        }[];
      };
      assign_quiz: { Args: { p_quiz: string; p_students?: string[] }; Returns: number };
      submit_quiz: {
        Args: { p_assignment: string; p_answers: number[] };
        Returns: QuizAssignmentRow;
      };
      sell_product: {
        Args: {
          p_product: string;
          p_quantity: number;
          p_student?: string;
          p_as_charge?: boolean;
        };
        Returns: ProductSaleRow;
      };
      grant_course_access: {
        Args: { p_course: string; p_student: string; p_create_charge?: boolean };
        Returns: CourseAccessRow;
      };
      request_course: { Args: { p_course: string; p_student: string }; Returns: undefined };
    };
    Enums: {
      member_role: MemberRole;
      membership_status: MembershipStatus;
      belt_track: BeltTrack;
      student_status: StudentStatus;
      charge_status: ChargeStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];
type TablesAndViews = PublicSchema['Tables'] & PublicSchema['Views'];

export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
