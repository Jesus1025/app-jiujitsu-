import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { TablesInsert } from '@/types/database';

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

export type QuizDraftQuestion = { prompt: string; options: string[]; correctIndex: number };

export function useQuizzes(academyId: string) {
  return useQuery({
    queryKey: ['quizzes', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useQuiz(id: string) {
  return useQuery({
    queryKey: ['quizzes', 'one', id],
    queryFn: async () => {
      const [quiz, questions] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', id).single(),
        supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('position'),
      ]);
      if (quiz.error) throw quiz.error;
      if (questions.error) throw questions.error;
      return {
        quiz: quiz.data,
        questions: questions.data.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options.map(String) : [],
        })),
      };
    },
  });
}

/** Crea la prueba con sus preguntas y respuestas correctas. */
export function useCreateQuiz(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      title: string;
      description?: string;
      autoSendAfterMonths?: number | null;
      questions: QuizDraftQuestion[];
    }) => {
      const { data: quiz, error } = await supabase
        .from('quizzes')
        .insert({
          academy_id: academyId,
          title: args.title,
          description: args.description || null,
          auto_send_after_months: args.autoSendAfterMonths ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(
          args.questions.map((q, index) => ({
            academy_id: academyId,
            quiz_id: quiz.id,
            position: index + 1,
            prompt: q.prompt,
            options: q.options,
          })),
        )
        .select('id, position');
      if (questionsError) throw questionsError;

      const { error: keysError } = await supabase.from('quiz_answer_keys').insert(
        questions.map((q) => ({
          question_id: q.id,
          academy_id: academyId,
          correct_index: args.questions[q.position - 1].correctIndex,
        })),
      );
      if (keysError) throw keysError;
      return quiz.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quizzes', academyId] }),
  });
}

export function useDeleteQuiz(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quizzes', academyId] }),
  });
}

/** Respuestas correctas (solo el staff puede leerlas). */
export function useQuizAnswerKeys(questionIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['quiz-keys', ...questionIds],
    enabled: enabled && questionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_answer_keys')
        .select('*')
        .in('question_id', questionIds);
      if (error) throw error;
      return new Map(data.map((k) => [k.question_id, k.correct_index]));
    },
  });
}

export function useQuizAssignments(filter: { quizId?: string; studentIds?: string[] }) {
  return useQuery({
    queryKey: ['quiz-assignments', filter],
    enabled: !!filter.quizId || !!filter.studentIds?.length,
    queryFn: async () => {
      let query = supabase.from('quiz_assignments').select('*');
      if (filter.quizId) query = query.eq('quiz_id', filter.quizId);
      if (filter.studentIds) query = query.in('student_id', filter.studentIds);
      const { data, error } = await query.order('assigned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quizId, studentIds }: { quizId: string; studentIds?: string[] }) => {
      const { data, error } = await supabase.rpc('assign_quiz', {
        p_quiz: quizId,
        p_students: studentIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] }),
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, answers }: { assignmentId: string; answers: number[] }) => {
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_assignment: assignmentId,
        p_answers: answers,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-assignments'] }),
  });
}

// ---------------------------------------------------------------------------
// Muro
// ---------------------------------------------------------------------------

export function usePosts(academyId: string) {
  return useQuery({
    queryKey: ['posts', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePost(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('posts').insert({ academy_id: academyId, body });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', academyId] }),
  });
}

export function useDeletePost(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts', academyId] }),
  });
}

// ---------------------------------------------------------------------------
// Tienda
// ---------------------------------------------------------------------------

export function useProducts(academyId: string) {
  return useQuery({
    queryKey: ['products', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('academy_id', academyId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveProduct(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'products'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('products').update(rest).eq('id', id)
        : await supabase.from('products').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', academyId] }),
  });
}

export function useSales(academyId: string) {
  return useQuery({
    queryKey: ['sales', academyId],
    enabled: !!academyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_sales')
        .select('*')
        .eq('academy_id', academyId)
        .order('sold_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useSellProduct(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      productId: string;
      quantity: number;
      studentId?: string;
      asCharge: boolean;
    }) => {
      const { error } = await supabase.rpc('sell_product', {
        p_product: args.productId,
        p_quantity: args.quantity,
        p_student: args.studentId,
        p_as_charge: args.asCharge,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', academyId] });
      queryClient.invalidateQueries({ queryKey: ['sales', academyId] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Cursos
// ---------------------------------------------------------------------------

export function useCourses(academyId: string) {
  return useQuery({
    queryKey: ['courses', academyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['courses', 'one', id],
    queryFn: async () => {
      const [course, lessons, access] = await Promise.all([
        supabase.from('courses').select('*').eq('id', id).single(),
        supabase.from('course_lessons').select('*').eq('course_id', id).order('position'),
        supabase.from('course_access').select('*').eq('course_id', id),
      ]);
      if (course.error) throw course.error;
      if (lessons.error) throw lessons.error;
      if (access.error) throw access.error;
      return { course: course.data, lessons: lessons.data, access: access.data };
    },
  });
}

export function useSaveCourse(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'courses'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { data, error } = id
        ? await supabase.from('courses').update(rest).eq('id', id).select('id').single()
        : await supabase.from('courses').insert(rest).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useSaveLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: TablesInsert<'course_lessons'> & { id?: string }) => {
      const { id, ...rest } = values;
      const { error } = id
        ? await supabase.from('course_lessons').update(rest).eq('id', id)
        : await supabase.from('course_lessons').insert(rest);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });
}

export function useGrantCourseAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { courseId: string; studentId: string; createCharge: boolean }) => {
      const { error } = await supabase.rpc('grant_course_access', {
        p_course: args.courseId,
        p_student: args.studentId,
        p_create_charge: args.createCharge,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
    },
  });
}

export function useRequestCourse() {
  return useMutation({
    mutationFn: async ({ courseId, studentId }: { courseId: string; studentId: string }) => {
      const { error } = await supabase.rpc('request_course', {
        p_course: courseId,
        p_student: studentId,
      });
      if (error) throw error;
    },
  });
}
