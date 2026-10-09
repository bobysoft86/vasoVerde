from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.colors import HexColor
import os

OUT = 'docs/manual-usuario-vaso-verde.pdf'
os.makedirs('docs', exist_ok=True)
GREEN = HexColor('#17684d')
DARK = HexColor('#18382c')
MINT = HexColor('#e8f3ed')
PALE = HexColor('#f5f7f2')
MUTED = HexColor('#61756b')
ORANGE = HexColor('#fff1dd')

font_dir = '/System/Library/Fonts/Supplemental'
pdfmetrics.registerFont(TTFont('DejaVu', f'{font_dir}/Arial.ttf'))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', f'{font_dir}/Arial Bold.ttf'))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName='DejaVu-Bold', fontSize=31, leading=37, textColor=DARK, spaceAfter=12))
styles.add(ParagraphStyle(name='CoverSub', fontName='DejaVu', fontSize=14, leading=21, textColor=MUTED))
styles.add(ParagraphStyle(name='H1x', fontName='DejaVu-Bold', fontSize=21, leading=26, textColor=DARK, spaceBefore=4, spaceAfter=13, keepWithNext=True))
styles.add(ParagraphStyle(name='H2x', fontName='DejaVu-Bold', fontSize=13, leading=17, textColor=GREEN, spaceBefore=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name='Bodyx', fontName='DejaVu', fontSize=9.4, leading=14, textColor=DARK, spaceAfter=7))
styles.add(ParagraphStyle(name='Smallx', fontName='DejaVu', fontSize=8, leading=11, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name='Bulletx', fontName='DejaVu', fontSize=9.2, leading=13, leftIndent=13, firstLineIndent=-8, bulletIndent=0, textColor=DARK, spaceAfter=4))
styles.add(ParagraphStyle(name='Calloutx', fontName='DejaVu-Bold', fontSize=9.1, leading=13.5, textColor=DARK))
styles.add(ParagraphStyle(name='Cellx', fontName='DejaVu', fontSize=8, leading=10.5, textColor=DARK))
styles.add(ParagraphStyle(name='CellBoldx', fontName='DejaVu-Bold', fontSize=8, leading=10.5, textColor=DARK))

story=[]
def P(text, style='Bodyx'): story.append(Paragraph(text, styles[style]))
def H1(text): P(text,'H1x')
def H2(text): P(text,'H2x')
def bullets(items):
    for item in items: story.append(Paragraph('• '+item, styles['Bulletx']))
def callout(text, bg=MINT):
    t=Table([[Paragraph(text,styles['Calloutx'])]], colWidths=[170*mm])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg),('BOX',(0,0),(-1,-1),0.5,HexColor('#d4e5da')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.extend([t,Spacer(1,8)])
def table(rows, widths, header=True):
    data=[]
    for r,row in enumerate(rows):
        data.append([Paragraph(str(c),styles['CellBoldx'] if header and r==0 else styles['Cellx']) for c in row])
    t=Table(data,colWidths=widths,repeatRows=1 if header else 0,hAlign='LEFT')
    cmds=[('GRID',(0,0),(-1,-1),0.35,HexColor('#d8e2dc')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]
    if header: cmds += [('BACKGROUND',(0,0),(-1,0),MINT)]
    for r in range(1 if header else 0,len(rows)):
        if (r-(1 if header else 0))%2==1: cmds.append(('BACKGROUND',(0,r),(-1,r),PALE))
    t.setStyle(TableStyle(cmds)); story.extend([t,Spacer(1,8)])
def page(): story.append(PageBreak())

# Cover
story += [Spacer(1,25*mm)]
mark=Table([[Paragraph('<b>VV</b>',ParagraphStyle('mark',fontName='DejaVu-Bold',fontSize=17,textColor=colors.white,alignment=TA_CENTER))]],colWidths=[19*mm],rowHeights=[19*mm])
mark.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),GREEN),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
story += [mark,Spacer(1,18*mm)]
P('MANUAL DE USUARIO','H2x')
P('Vaso Verde','CoverTitle')
P('Guía práctica para gestionar eventos, vasos reutilizables, caja y operaciones del equipo.','CoverSub')
story.append(Spacer(1,20*mm))
callout('Este manual describe el funcionamiento de la aplicación. Los nombres de botones pueden variar ligeramente según el rol y los permisos de la cuenta.',MINT)
story.append(Spacer(1,45*mm))
P('Edición de octubre de 2026 · Aplicación web adaptable a móvil y escritorio','Smallx')
P('Contenido: administración · portal de trabajadores · caja · stock y lavado · serigrafías · cierres','Smallx')
page()

H1('1. Primer acceso y navegación')
P('Abre la dirección web proporcionada por la organización e inicia sesión con tu correo y contraseña. La aplicación muestra solo las secciones permitidas para tu rol. En móvil, el botón de menú abre la navegación lateral.')
table([['Sección','Para qué sirve'],['Dashboard','Resumen general; visible para administración.'],['Portal','Eventos asignados y puntos de trabajo disponibles.'],['Eventos','Consultar y gestionar cada evento y sus operaciones.'],['Nave central','Stock global, lavado, caja matriz y abastecimiento.'],['Tipos de vaso','Modelos genéricos y referencias serigrafiadas.'],['Usuarios','Cuentas, roles y accesos.']], [38*mm,132*mm])
H2('Roles habituales')
table([['Rol','Uso habitual'],['Administrador','Configura empresa, catálogo, eventos, nave y usuarios.'],['Responsable','Coordina el evento y las ubicaciones que tiene asignadas.'],['Trabajador','Opera el POS en las ubicaciones asignadas.'],['Cliente','Acceso limitado asociado a la barra/empresa.']], [38*mm,132*mm])
callout('Si no ves una sección o un evento, puede ser una cuestión de permisos o de asignación. Pide al administrador que revise tu usuario y la pestaña Usuarios/Asignaciones del evento.')

H1('2. Preparar un evento')
P('En Eventos, crea el evento indicando un nombre y un código propios, fechas y ubicación. Si una fiesta se repite, crea un registro nuevo: no reutilices el evento anterior. El código identifica esa edición y debe ser único.')
H2('Añadir lugares y equipo')
bullets(['En las pestañas Casetas y Barras, crea las ubicaciones que se usarán.','En Usuarios, añade al personal al evento. En Asignaciones, concede acceso a las casetas o barras concretas.','Puedes asignar varias personas a una ubicación. El acceso al evento por sí solo no siempre habilita la operativa de un lugar.','Comprueba que las barras externas estén asociadas al usuario cliente correcto cuando se use esa función.'])
H2('Preparar cajas del evento')
P('El personal abre la caja del punto de trabajo a 0 €. El fondo de cambio se transfiere después desde la caja de la nave. Así queda registrado qué efectivo salió de la nave y qué caja lo recibió.')
callout('Antes de operar: revisa el evento activo, sus ubicaciones, las asignaciones y el catálogo de vasos de esa edición.')

H1('3. Tipos de vaso, modelos y serigrafías')
P('Cada referencia del catálogo mantiene su propio stock. Un vaso genérico puede usarse en distintos eventos. Un vaso serigrafiado pertenece a una edición concreta de un evento; si el festival se repite, su nueva edición tiene una referencia de vaso distinta.')
table([['Referencia','Dónde puede moverse'],['Genérica','Cualquier evento.'],['Serigrafía del Festival 2026','Festival 2026 y circuito de nave/lavado.'],['Serigrafía del Festival 2027','Festival 2027 y circuito de nave/lavado.']], [67*mm,103*mm])
H2('Crear una referencia')
bullets(['Abre Tipos de vaso y crea primero el modelo físico genérico, por ejemplo “Vaso 33 cl”.','Para una serigrafía, crea otra referencia con nombre/código propio; selecciona el evento y el modelo físico genérico.','El evento y modelo asignados son permanentes. Si hay nueva edición, crea otra referencia; no recicles la anterior.','Las referencias que ya existían antes de esta función se consideran genéricas.'])
callout('Ejemplo: al preparar Festival 2027, los selectores permiten “Vaso 33 cl · Genérico” y “Vaso 33 cl · Festival 2027”; bloquean “Vaso 33 cl · Festival 2026”.')
H2('Qué se conserva')
P('La referencia del vaso viaja junto con el movimiento: entrega, devolución, venta, cierre, albarán y lavado. El lavado cambia la condición física de sucio a limpio; nunca cambia el evento impreso.')

H1('4. Nave central y circuito de lavado')
P('Nave central es el punto de control del stock propio. En su panel se ven el stock de la nave, el que está en la zona de lavado y los últimos movimientos. La tarjeta “Mover vasos” registra las operaciones del circuito.')
table([['Paso','Operación','Efecto esperado'],['1','Recibir sobrantes de evento','Los vasos recogidos entran en nave con su condición: limpios, sucios o dañados.'],['2','Enviar sucios a lavado','Salen de nave solo las cantidades sucias disponibles; pasan a la zona de lavado.'],['3','Retorno limpio de lavado','Salen de lavado los sucios procesados y entran limpios en nave.'],['4','Entregar a evento','Los vasos limpios salen de nave y entran al almacén del evento compatible.']], [12*mm,44*mm,114*mm])
H2('Cómo registrar')
bullets(['En Operación, elige el paso del circuito. Selecciona evento y almacén cuando la operación los necesite.','Elige la referencia del vaso y cantidad. El selector presenta el stock disponible por estado (L limpio, S sucio, D dañado).','Revisa la ruta origen → destino. Añade notas si ayudan a identificar el lote o la recogida.','Pulsa Registrar movimiento y espera el mensaje de confirmación. Actualiza la vista para comprobar los saldos.'])
callout('La pantalla y la API comprueban disponibilidad. No registres retornos de lavado hasta que el lavado haya terminado y los vasos estén realmente limpios.')

H1('5. Operativa del trabajador: Portal y POS')
P('En Portal, abre el evento asignado y selecciona el punto de trabajo. El POS muestra la caja, el stock y las acciones habilitadas para esa ubicación.')
H2('Caseta y almacén')
bullets(['Venta de vaso: registra la salida de una unidad limpia y el importe cobrado. El POS comprueba el stock limpio.','Devolución de vaso: registra el euro devuelto y añade un vaso sucio a esa ubicación. Selecciona la referencia correcta.','Usa caja para registrar entradas, salidas, retiradas o gastos autorizados. Los movimientos afectan el saldo esperado.'])
H2('Barra externa')
bullets(['Recoger: registra vasos que salen de la barra hacia la caseta, almacén o nave, según el destino. La recogida puede superar las entregas anotadas por Vaso Verde porque la barra externa no tiene control completo de entradas.','Entregar: registra la salida de vasos limpios desde el origen seleccionado hacia la barra. La segunda entrega puede marcarse con cargo y asociarse a la caja abierta de la barra.','El selector muestra el stock del origen para entregas y el stock controlado del punto correspondiente. La selección de condición permite registrar la recogida real.','Cada movimiento puede generar un albarán para consultar y firmar.'])
H2('Cierre de barra')
bullets(['Introduce el recuento final de limpios, sucios y dañados por referencia de vaso. Puede ser cero en todas las condiciones.','El sistema compara entregas/cobros registrados con la recogida y calcula el saldo de vasos y dinero.','Indica el destino de la recogida y confirma el cierre. Después registra la liquidación en caja o como pendiente, si no hay caja disponible.','El pendiente queda identificado para reclamación o pago posterior; no lo marques como liquidado hasta recibir o devolver el dinero.'])
callout('Un cierre es final para esa ubicación. Comprueba el destino y el recuento antes de confirmarlo.')

H1('6. Caja: fondo, movimientos y liquidación')
H2('Caja de una ubicación')
P('Las cajas de evento se abren con saldo inicial 0 €. El fondo se recibe con una transferencia desde la nave. El POS muestra saldo esperado; al cerrar, se introduce el efectivo contado. La diferencia queda registrada para arqueo.')
H2('Caja matriz de la nave')
bullets(['Abre la caja central con el fondo inicial real.','Desde “Enviar fondo a un evento”, transfiere dinero a cajas abiertas. La operación registra salida central y entrada en destino.','Al terminar, cierra las cajas de evento y registra el efectivo contado.','En Nave central, usa “Devolver efectivo a la nave” para liquidar cajas cerradas pendientes. Registra solo el importe efectivamente entregado.'])
table([['Movimiento','Qué significa'],['Entrada / salida','Variación manual de efectivo con concepto.'],['Gasto','Pago desde caja; reduce saldo.'],['Venta de vaso','Cobro asociado a la salida de vaso limpio.'],['Devolución de vaso','Reembolso asociado a la entrada de vaso sucio.'],['Liquidación','Transferencia real de efectivo de una caja cerrada a nave.']], [42*mm,128*mm])
callout('No abras una caja de evento con dinero supuesto. Primero abre a cero y registra el fondo desde la nave para que ambas cajas cuadren.')
page()

H1('7. Movimientos, stock y albaranes')
P('Dentro del evento, las pestañas Movimientos y Stock ayudan a consultar el historial y existencias por ubicación. El formulario de movimiento presenta stock de las referencias disponibles en el origen. La validación del servidor vuelve a comprobar las cantidades al guardar.')
bullets(['Entrega: origen → destino; normalmente vasos limpios.','Recogida: devuelve vasos y registra la condición física observada.','Envío a limpieza: requiere stock sucio disponible en el origen.','Retorno de limpieza: requiere unidades disponibles en zona de lavado y las devuelve limpias.','Pérdida/rotura/ajuste: indica un motivo y utiliza los permisos correspondientes.','Albarán: abre el documento vinculado al movimiento, revisa las líneas y solicita las firmas necesarias.'])
H2('Si ves stock negativo o un saldo inesperado')
bullets(['Revisa los últimos movimientos y confirma referencia, condición, origen y destino.','Comprueba que no se haya registrado la misma entrega/recogida dos veces.','En barras externas, diferencia el stock controlado de las entradas reales que no registra la empresa.','No corrijas balances editando registros a mano; documenta la incidencia y pide revisión administrativa.'])

H1('8. Cierre del evento')
P('Utiliza la pantalla de cierre como lista de verificación. No cierres hasta que el stock y el efectivo estén físicamente recogidos o correctamente pendientes.')
table([['Comprobación','Acción'],['Barras y casetas','Realizar recuento, registrar recogida y cerrar cada ubicación.'],['Cajas abiertas','Arqueo y cierre con efectivo contado.'],['Efectivo pendiente de volver','Transferir físicamente a nave y registrar liquidación.'],['Albaranes','Revisar firmas y documentos pendientes.'],['Lavado','Terminar las operaciones internas necesarias y comprobar su stock.'],['Estado del evento','Cuando no queden bloqueos, cambiar el estado según el proceso de la organización.']], [51*mm,119*mm])
callout('Cerrar una ubicación registra también las diferencias de stock según el recuento. Si declaras cero, el cierre puede ser válido; asegúrate de haber contado el material.')

H1('9. Guía rápida por rol')
table([['Necesito…','Ruta'],['Registrar vaso nuevo de fábrica','Nave central → Recepcionar vasos nuevos.'],['Enviar sucios a lavar','Nave central → Mover vasos → Enviar sucios a lavado.'],['Volver vasos limpios a stock','Nave central → Mover vasos → Retorno limpio de lavado.'],['Preparar serigrafía de otra edición','Tipos de vaso → crear referencia ligada al evento nuevo.'],['Operar una caseta','Portal → evento → caseta → POS.'],['Operar una barra','Portal → evento → barra → entregar/recoger o cierre.'],['Transferir fondo','Nave central → Caja matriz → Enviar fondo a un evento.'],['Liquidar efectivo recogido','Nave central → Devolver efectivo a la nave.']], [70*mm,100*mm])
H2('Buenas prácticas')
bullets(['Registra las operaciones en el momento y con el punto físico correcto.','Usa una referencia distinta para cada serigrafía y edición del evento.','Separa cantidad y condición; no combines sucios con limpios en una misma línea.','Antes de confirmar un cierre o transferencia, verifica la cantidad/importe real.','Si el resultado de una operación queda incierto por una pérdida de conexión, revisa el historial antes de repetirla.'])
P('Manual preparado a partir de las pantallas y flujos disponibles en Vaso Verde, edición de octubre de 2026. La aplicación puede recibir cambios; si una pantalla difiere, sigue las validaciones mostradas y consulta al administrador.','Smallx')

def decorate(canvas, doc):
    canvas.saveState(); w,h=A4
    if doc.page > 1:
        canvas.setFillColor(GREEN); canvas.rect(0,h-10*mm,w,10*mm,fill=1,stroke=0)
        canvas.setFont('DejaVu-Bold',8); canvas.setFillColor(colors.white)
        canvas.drawString(20*mm,h-6.5*mm,'VASO VERDE  |  MANUAL DE USUARIO')
        canvas.setStrokeColor(HexColor('#d8e2dc')); canvas.line(20*mm,14*mm,w-20*mm,14*mm)
        canvas.setFont('DejaVu',8); canvas.setFillColor(MUTED)
        canvas.drawString(20*mm,9*mm,'Guía operativa · Octubre 2026')
        canvas.drawRightString(w-20*mm,9*mm,f'{doc.page}')
    canvas.restoreState()

doc=SimpleDocTemplate(OUT,pagesize=A4,rightMargin=20*mm,leftMargin=20*mm,topMargin=18*mm,bottomMargin=20*mm,title='Manual de usuario - Vaso Verde',author='Vaso Verde')
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
print(OUT)
