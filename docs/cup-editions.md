# Vasos genéricos y serigrafías

Cada referencia del catálogo mantiene su propio stock. `CupType` representa tanto
el modelo genérico como sus referencias serigrafiadas: `baseTypeId` vincula el
modelo físico y `ownerEventId` identifica la celebración concreta. Los movimientos,
caja, albaranes y liquidaciones conservan el ID de esa referencia. No se agregan
ediciones distintas aunque tengan la misma capacidad.

En **Tipos de vaso**, crea primero el modelo genérico. Para una serigrafía crea
otra referencia con código y nombre propios, selecciona ese modelo y su evento.
El evento y el modelo no se pueden cambiar después. Las referencias existentes
se conservan como genéricas; no se deduce su serigrafía a partir del histórico.

Un evento repetido se crea con un ID y código nuevos. Sus vasos son independientes.
El servidor admite genéricos y serigrafías de ese evento en movimientos, cierres,
ventas y devoluciones de caja. La nave y el lavado admiten todas las referencias;
lavar solo transforma su condición, nunca su pertenencia.

## Ejemplo del seeder

- Festival 2026: 1.000 vasos serigrafiados recibidos, 300 entregados, 100 recogidos
  sucios, 100 enviados a lavado y 80 recuperados limpios.
- Resultado: 780 limpios en nave, 200 en evento y 20 sucios en lavado.
- Festival 2027: 1.000 vasos de otra serigrafía en nave.
- Los tres modelos genéricos siguen disponibles para cualquier evento.
- El seeder comprueba estos saldos con aserciones y omite empresas demo con
  operaciones existentes. No añade los ejemplos a una base ya utilizada.

Aplicar el esquema con `npx prisma migrate deploy` y regenerar el cliente con
`npx prisma generate`. En una base demo vacía ejecutar `npx prisma db seed`.
No es necesario resetear datos para instalar esta funcionalidad.

Ejecutar `npm test -- --runInBand` desde backend. Las pruebas incluyen rechazo de
ediciones ajenas en servicios de stock/caja, cierres, cargas mixtas y conservación
de identidad durante lavado parcial. La migración es aditiva.
