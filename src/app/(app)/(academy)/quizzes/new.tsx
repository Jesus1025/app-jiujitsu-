import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { type QuizDraftQuestion, useCreateQuiz } from '@/features/content/api';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';

const emptyQuestion = (): QuizDraftQuestion => ({ prompt: '', options: ['', ''], correctIndex: 0 });

/** Crear una prueba de alternativas. La nota se calcula sola (escala 1,0 a 7,0, exigencia 60 %). */
export default function NewQuizScreen() {
  const { academy } = useAcademy();
  const theme = useTheme();
  const create = useCreateQuiz(academy.id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [autoMonths, setAutoMonths] = useState('');
  const [questions, setQuestions] = useState<QuizDraftQuestion[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, change: Partial<QuizDraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...change } : q)));
  }

  function handleSave() {
    const cleaned = questions.map((q) => ({
      ...q,
      prompt: q.prompt.trim(),
      options: q.options.map((o) => o.trim()),
    }));
    if (!title.trim()) return setError('Ingresa el título.');
    if (cleaned.some((q) => !q.prompt)) return setError('Todas las preguntas necesitan enunciado.');
    if (cleaned.some((q) => q.options.some((o) => !o)))
      return setError('Completa todas las alternativas.');
    const months = autoMonths.trim() ? Number(autoMonths) : null;
    if (months !== null && (!Number.isInteger(months) || months < 1))
      return setError('Meses inválidos.');
    setError(null);
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        autoSendAfterMonths: months,
        questions: cleaned,
      },
      {
        onSuccess: (id) => router.replace(`/quizzes/${id}`),
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: 'Nueva prueba' }} />
      <TextField
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Ej: Manual del alumno nuevo"
      />
      <TextField
        label="Instrucciones (opcional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextField
        label="Enviar sola a los X meses de ingreso (opcional)"
        value={autoMonths}
        onChangeText={setAutoMonths}
        keyboardType="number-pad"
        placeholder="Ej: 3"
      />
      <ThemedText type="small" themeColor="textSecondary">
        La prueba no influye en la graduación: sirve para ver si el alumno estudió el manual.
      </ThemedText>

      {questions.map((question, index) => (
        <Section key={index} title={`Pregunta ${index + 1}`}>
          <TextField
            label="Enunciado"
            value={question.prompt}
            onChangeText={(prompt) => updateQuestion(index, { prompt })}
            multiline
          />
          {question.options.map((option, optionIndex) => (
            <View key={optionIndex} style={styles.option}>
              <View style={styles.flex}>
                <TextField
                  label={`Alternativa ${String.fromCharCode(65 + optionIndex)}${
                    question.correctIndex === optionIndex ? ' (correcta)' : ''
                  }`}
                  value={option}
                  onChangeText={(text) =>
                    updateQuestion(index, {
                      options: question.options.map((o, i) => (i === optionIndex ? text : o)),
                    })
                  }
                  style={
                    question.correctIndex === optionIndex
                      ? { borderColor: theme.success }
                      : undefined
                  }
                />
              </View>
              <Button
                title={question.correctIndex === optionIndex ? '✓' : 'Correcta'}
                variant={question.correctIndex === optionIndex ? 'primary' : 'ghost'}
                onPress={() => updateQuestion(index, { correctIndex: optionIndex })}
              />
            </View>
          ))}
          <View style={styles.option}>
            {question.options.length < 6 ? (
              <Button
                title="+ Alternativa"
                variant="ghost"
                onPress={() => updateQuestion(index, { options: [...question.options, ''] })}
              />
            ) : null}
            {question.options.length > 2 ? (
              <Button
                title="− Alternativa"
                variant="ghost"
                onPress={() =>
                  updateQuestion(index, {
                    options: question.options.slice(0, -1),
                    correctIndex: Math.min(question.correctIndex, question.options.length - 2),
                  })
                }
              />
            ) : null}
            {questions.length > 1 ? (
              <Button
                title="Quitar pregunta"
                variant="ghost"
                onPress={() => setQuestions((qs) => qs.filter((_, i) => i !== index))}
              />
            ) : null}
          </View>
        </Section>
      ))}
      <Button
        title="Agregar pregunta"
        variant="secondary"
        onPress={() => setQuestions((qs) => [...qs, emptyQuestion()])}
      />
      <FormError message={error} />
      <Button title="Guardar prueba" onPress={handleSave} loading={create.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, flexWrap: 'wrap' },
  flex: { flex: 1 },
});
