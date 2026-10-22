import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { goBack } from '@/lib/navigation';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Select } from '@/components/ui/select';
import { QueryState } from '@/components/ui/states';
import { SwitchRow } from '@/components/ui/switch-row';
import { TextField } from '@/components/ui/text-field';
import { useAcademy } from '@/features/academies/active-academy';
import { useProducts, useSaveProduct, useSellProduct } from '@/features/content/api';
import { useStudents } from '@/features/students/api';
import { errorMessage } from '@/lib/errors';
import { formatMoney, fullName, parseAmount } from '@/lib/format';
import type { Tables } from '@/types/database';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { academy } = useAcademy();
  const products = useProducts(academy.id);
  const product = products.data?.find((p) => p.id === id);

  if (id && !product) {
    return (
      <Screen safeArea="bottom">
        <QueryState
          isLoading={products.isLoading}
          error={products.error}
          onRetry={products.refetch}
        />
      </Screen>
    );
  }
  return (
    <Screen safeArea="bottom">
      <Stack.Screen options={{ title: product ? product.name : 'Nuevo producto' }} />
      {product ? <SellForm product={product} /> : null}
      <ProductForm product={product} />
    </Screen>
  );
}

function ProductForm({ product }: { product?: Tables<'products'> }) {
  const { academy } = useAcademy();
  const save = useSaveProduct(academy.id);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [active, setActive] = useState(product?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const value = parseAmount(price);
    const units = Number(stock);
    if (!name.trim()) return setError('Ingresa el nombre.');
    if (value === null) return setError('Ingresa el precio.');
    if (!Number.isInteger(units) || units < 0) return setError('Stock inválido.');
    setError(null);
    save.mutate(
      {
        id: product?.id,
        academy_id: academy.id,
        name: name.trim(),
        description: description.trim() || null,
        price: value,
        stock: units,
        active,
      },
      { onSuccess: () => goBack(), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Section title={product ? 'Editar producto' : 'Datos del producto'}>
      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Parche de la academia"
      />
      <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} />
      <TextField label="Precio" value={price} onChangeText={setPrice} keyboardType="number-pad" />
      <TextField
        label="Stock (unidades)"
        value={stock}
        onChangeText={setStock}
        keyboardType="number-pad"
      />
      <SwitchRow label="Visible para los alumnos" value={active} onChange={setActive} />
      <FormError message={error} />
      <Button title="Guardar" onPress={handleSave} loading={save.isPending} />
    </Section>
  );
}

function SellForm({ product }: { product: Tables<'products'> }) {
  const { academy } = useAcademy();
  const sell = useSellProduct(academy.id);
  const { data: students } = useStudents(academy.id);
  const [quantity, setQuantity] = useState('1');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [asCharge, setAsCharge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const units = Number(quantity);

  function handleSell() {
    if (!Number.isInteger(units) || units < 1) return setError('Cantidad inválida.');
    if (asCharge && !studentId) return setError('Para dejarlo pendiente elige al alumno.');
    setError(null);
    sell.mutate(
      { productId: product.id, quantity: units, studentId: studentId ?? undefined, asCharge },
      {
        onSuccess: () => {
          setDone(`Venta registrada: ${units} × ${product.name}.`);
          setQuantity('1');
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  return (
    <Section title={`Vender · quedan ${product.stock}`}>
      <TextField
        label="Cantidad"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
      />
      <Select
        label="Alumno (opcional)"
        value={studentId}
        onChange={setStudentId}
        allowClear
        searchable
        placeholder="Venta sin alumno"
        options={(students ?? [])
          .filter((s) => s.status === 'active')
          .map((s) => ({ value: s.id, label: fullName(s) }))}
      />
      <SwitchRow
        label="Dejar como deuda del alumno"
        hint="Se crea un cobro pendiente en lugar de pagarlo ahora."
        value={asCharge}
        onChange={setAsCharge}
      />
      <FormError message={error} />
      <Button
        title={`Registrar venta${Number.isInteger(units) && units > 0 ? ` (${formatMoney(product.price * units)})` : ''}`}
        onPress={handleSell}
        loading={sell.isPending}
      />
      {done ? <ThemedText type="small">{done}</ThemedText> : null}
    </Section>
  );
}
