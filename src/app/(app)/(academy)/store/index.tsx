import { router, Stack } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListItem } from '@/components/ui/list-item';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { EmptyState, QueryState } from '@/components/ui/states';
import { useAcademy } from '@/features/academies/active-academy';
import { useProducts, useSales } from '@/features/content/api';
import { useStudents } from '@/features/students/api';
import { formatDate, formatMoney, fullName } from '@/lib/format';

/** Tienda: el staff maneja inventario y ventas; los alumnos ven productos y precios. */
export default function StoreScreen() {
  const { academy, isStaff } = useAcademy();
  const products = useProducts(academy.id);
  const { data: sales } = useSales(isStaff ? academy.id : '');
  const { data: students } = useStudents(academy.id);
  const visible = (products.data ?? []).filter((p) => isStaff || p.active);

  return (
    <Screen safeArea="bottom" refreshing={products.isRefetching} onRefresh={products.refetch}>
      <Stack.Screen options={{ title: isStaff ? 'Tienda e inventario' : 'Tienda' }} />
      {isStaff ? (
        <Button title="Agregar producto" onPress={() => router.push('/store/product')} />
      ) : null}
      <QueryState
        isLoading={products.isLoading}
        error={products.error}
        onRetry={products.refetch}
      />
      {products.data && !visible.length ? <EmptyState message="Aún no hay productos." /> : null}
      {visible.map((product) => (
        <ListItem
          key={product.id}
          title={product.name}
          subtitle={[product.description, isStaff ? `Stock: ${product.stock}` : null]
            .filter(Boolean)
            .join(' · ')}
          right={
            isStaff && !product.active ? (
              <Badge label="Oculto" />
            ) : isStaff && product.stock === 0 ? (
              <Badge label="Sin stock" tone="danger" />
            ) : (
              formatMoney(product.price)
            )
          }
          onPress={
            isStaff
              ? () => router.push({ pathname: '/store/product', params: { id: product.id } })
              : undefined
          }
        />
      ))}
      {!isStaff ? (
        <ThemedText type="small" themeColor="textSecondary">
          Para comprar, pídeselo a tu profesor en la academia.
        </ThemedText>
      ) : null}

      {isStaff ? (
        <Section title="Ventas recientes">
          {sales?.length ? (
            sales.map((sale) => {
              const product = products.data?.find((p) => p.id === sale.product_id);
              const student = students?.find((s) => s.id === sale.student_id);
              return (
                <ListItem
                  key={sale.id}
                  title={`${sale.quantity} × ${product?.name ?? 'Producto'}`}
                  subtitle={[
                    formatDate(sale.sold_at),
                    student ? fullName(student) : null,
                    sale.charge_id ? 'Pendiente de pago' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  right={formatMoney(sale.total)}
                />
              );
            })
          ) : (
            <EmptyState message="Sin ventas registradas." />
          )}
        </Section>
      ) : null}
    </Screen>
  );
}
