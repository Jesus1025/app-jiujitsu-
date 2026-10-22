import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState, QueryState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAcademy } from '@/features/academies/active-academy';
import { useBelts, useCategories } from '@/features/academies/api';
import { useStudentBalances, useStudentProgressList, useStudents } from '@/features/students/api';
import { exportStudentsCsv } from '@/features/students/export';
import { categoryFor } from '@/features/students/helpers';
import { errorMessage } from '@/lib/errors';
import { formatMoney, fullName, todayIn } from '@/lib/format';

type Filter = 'active' | 'pending' | 'inactive';

export default function StudentsScreen() {
  const { academy } = useAcademy();
  const students = useStudents(academy.id);
  const { data: progress } = useStudentProgressList(academy.id);
  const { data: balances } = useStudentBalances(academy.id);
  const { data: belts } = useBelts(academy.id);
  const { data: categories } = useCategories(academy.id);
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const today = todayIn(academy.timezone);

  const all = students.data ?? [];
  const counts = {
    active: all.filter((s) => s.status === 'active').length,
    pending: all.filter((s) => s.status === 'pending').length,
    inactive: all.filter((s) => s.status === 'inactive').length,
  };
  const normalized = query.trim().toLowerCase();
  const visible = all.filter(
    (s) =>
      s.status === filter &&
      (!normalized ||
        fullName(s).toLowerCase().includes(normalized) ||
        (s.rut ?? '').toLowerCase().includes(normalized)) &&
      (categoryId === 'all' || categoryFor(s.birth_date, categories, today)?.id === categoryId),
  );

  async function handleExport() {
    try {
      await exportStudentsCsv({
        academyName: academy.name,
        students: all,
        progress,
        balances,
        belts,
        categories,
        today,
      });
    } catch (error) {
      Alert.alert('No se pudo exportar', errorMessage(error));
    }
  }

  return (
    <Screen safeArea="none" refreshing={students.isRefetching} onRefresh={students.refetch}>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Nuevo alumno" onPress={() => router.push('/students/new')} />
        </View>
        <View style={styles.action}>
          <Button title="Exportar a Excel" variant="secondary" onPress={handleExport} />
        </View>
      </View>

      <TextField label="Buscar" value={query} onChangeText={setQuery} placeholder="Nombre o RUT" />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: `Activos (${counts.active})` },
          { value: 'pending', label: `Por aprobar (${counts.pending})` },
          { value: 'inactive', label: `De baja (${counts.inactive})` },
        ]}
      />
      <Segmented
        value={categoryId}
        onChange={setCategoryId}
        options={[
          { value: 'all', label: 'Todas' },
          ...(categories ?? []).map((c) => ({ value: c.id, label: c.name.split(' /')[0] })),
        ]}
      />

      <QueryState
        isLoading={students.isLoading}
        error={students.error}
        onRetry={students.refetch}
      />
      {students.data && !visible.length ? (
        <EmptyState message="No hay alumnos en esta lista." />
      ) : null}

      <View>
        {visible.map((student) => {
          const p = progress?.get(student.id);
          const belt = belts?.find((b) => b.id === p?.belt_id);
          const debt = balances?.get(student.id);
          const category = categoryFor(student.birth_date, categories, today);
          return (
            <ListItem
              key={student.id}
              title={fullName(student)}
              subtitle={[
                category?.name,
                belt ? `${belt.name}${p?.degree ? ` ${p.degree}°` : ''}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              left={<Avatar name={fullName(student)} photoPath={student.photo_path} />}
              right={
                debt?.overdue_months ? (
                  <Badge label={formatMoney(debt.pending_amount)} tone="danger" />
                ) : debt?.pending_amount ? (
                  <Badge label={formatMoney(debt.pending_amount)} tone="warning" />
                ) : undefined
              }
              onPress={() => router.push(`/students/${student.id}`)}
            />
          );
        })}
      </View>
      {visible.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {visible.length} alumno(s)
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
