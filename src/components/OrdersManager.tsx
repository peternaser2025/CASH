import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  FileSpreadsheet,
  Printer,
  FileDown,
  ChevronDown,
  Building2,
  User,
  Phone,
  Package,
  Check,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Timer,
  CheckCircle,
  ListOrdered,
  CalendarClock,
  Kanban,
  FileText,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Order, OrderItem, OrderPriority, OrderStatus, OrderType, PaymentStatus } from '../types';
import { formatKWD, normalizeArabicSearch } from '../utils/format';
import { exportElementToPDF } from '../utils/pdfExport';

interface OrdersManagerProps {
  branches: string[];
  employees: string[];
  onRefresh?: () => void;
}

const STORAGE_KEY = 'kwd_orders_schedule_v1';

// Initial realistic seed orders if none in localStorage
const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    orderNumber: 'ORD-2026-001',
    title: 'توريد كراتين وتغليف فاخر لشهر أغسطس',
    type: 'purchase',
    supplierOrCustomer: 'شركة الكويت للتغليف والكرتون',
    branch: 'تعبئة وتغليف',
    orderDate: '2026-08-10',
    deliveryDueDate: '2026-08-18',
    amount: 850.000,
    paidAmount: 300.000,
    status: 'in_progress',
    priority: 'urgent',
    paymentStatus: 'partial',
    assignedEmployee: 'بيتر ناصر',
    contactPhone: '+965 99887766',
    notes: 'التسليم مباشرة لمستودع التعبئة والتغليف مع فحص الجودة قبل الاستلام',
    items: [
      { id: 'it-1', name: 'كراتين شحن مقاس كبير (A3)', quantity: 2000, unit: 'حبة', unitPrice: 0.250, totalPrice: 500.000 },
      { id: 'it-2', name: 'رولات تغليف فقاعي هوائي 100م', quantity: 50, unit: 'رول', unitPrice: 5.000, totalPrice: 250.000 },
      { id: 'it-3', name: 'أشرطة لاصقة مطبوعة بالشعار', quantity: 100, unit: 'حبة', unitPrice: 1.000, totalPrice: 100.000 }
    ],
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-15T10:30:00.000Z'
  },
  {
    id: 'ord-102',
    orderNumber: 'ORD-2026-002',
    title: 'توريد ورد طبيعي هولندي واكوادوري',
    type: 'supply',
    supplierOrCustomer: 'مؤسسة الزهور العالمية للتجارة',
    branch: 'الورده الانيقة',
    orderDate: '2026-08-14',
    deliveryDueDate: '2026-08-17',
    amount: 1250.000,
    paidAmount: 1250.000,
    status: 'shipped',
    priority: 'high',
    paymentStatus: 'paid',
    assignedEmployee: 'محمد جابر',
    contactPhone: '+965 66554433',
    notes: 'شحنة مبردة جوية، موعد الاستلام في صالة الفرع الساعة 4 عصراً',
    items: [
      { id: 'it-4', name: 'جوري أحمر اكوادوري فاخر', quantity: 500, unit: 'غصن', unitPrice: 1.200, totalPrice: 600.000 },
      { id: 'it-5', name: 'بيبي روز هولندي ألوان مشكلة', quantity: 400, unit: 'غصن', unitPrice: 0.900, totalPrice: 360.000 },
      { id: 'it-6', name: 'توليب أبيض وهيدرانجيا', quantity: 200, unit: 'غصن', unitPrice: 1.450, totalPrice: 290.000 }
    ],
    createdAt: '2026-08-14T08:00:00.000Z',
    updatedAt: '2026-08-16T14:00:00.000Z'
  },
  {
    id: 'ord-103',
    orderNumber: 'ORD-2026-003',
    title: 'تجهيز وتوريد ضيافة حفل تخرج لعميل VIP',
    type: 'customer',
    supplierOrCustomer: 'السيد/ خالد العتيبي',
    branch: 'رونزا',
    orderDate: '2026-08-12',
    deliveryDueDate: '2026-08-20',
    amount: 680.000,
    paidAmount: 340.000,
    status: 'in_progress',
    priority: 'high',
    paymentStatus: 'partial',
    assignedEmployee: 'أحمد علي',
    contactPhone: '+965 99112233',
    notes: 'التوصيل لقاعة الاحتفالات بمنطقة حطين الساعة 6 مساءً',
    items: [
      { id: 'it-7', name: 'ستاندات زهور طبيعية وتنسيق ملكي', quantity: 4, unit: 'طقم', unitPrice: 120.000, totalPrice: 480.000 },
      { id: 'it-8', name: 'صواني شوكولاتة وضيافة خاصة', quantity: 5, unit: 'صينية', unitPrice: 40.000, totalPrice: 200.000 }
    ],
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z'
  },
  {
    id: 'ord-104',
    orderNumber: 'ORD-2026-004',
    title: 'صيانة وتوريد قطع أجهزة التكييف المركزي',
    type: 'purchase',
    supplierOrCustomer: 'شركة البرد للتكييف والصيانة',
    branch: 'سيتي',
    orderDate: '2026-08-08',
    deliveryDueDate: '2026-08-14',
    actualDeliveryDate: '2026-08-14',
    amount: 420.000,
    paidAmount: 420.000,
    status: 'delivered',
    priority: 'normal',
    paymentStatus: 'paid',
    assignedEmployee: 'محمود حسن',
    contactPhone: '+965 55443322',
    notes: 'تم استلام القطع واختبار عمل الوحدات والتوقيع على محضر الفحص الفني',
    items: [
      { id: 'it-9', name: 'كمبروسر تكييف 4 طن', quantity: 1, unit: 'قطعة', unitPrice: 280.000, totalPrice: 280.000 },
      { id: 'it-10', name: 'غاز فريون أمريكي R410', quantity: 2, unit: 'اسطوانة', unitPrice: 70.000, totalPrice: 140.000 }
    ],
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-14T17:00:00.000Z'
  },
  {
    id: 'ord-105',
    orderNumber: 'ORD-2026-005',
    title: 'توريد شحنة مواد خام وأكياس مطبوعة',
    type: 'purchase',
    supplierOrCustomer: 'مصنع الشرق للبلاستيك',
    branch: ' دار السلام',
    orderDate: '2026-08-05',
    deliveryDueDate: '2026-08-15',
    amount: 980.000,
    paidAmount: 0,
    status: 'delayed',
    priority: 'urgent',
    paymentStatus: 'unpaid',
    assignedEmployee: 'بيتر ناصر',
    contactPhone: '+965 97766554',
    notes: 'متأخرة عن موعدها! تم التواصل مع المورد ووعد بالتسليم غداً صباحاً',
    items: [
      { id: 'it-11', name: 'أكياس تسوق مطبوعة قياس وسط', quantity: 10000, unit: 'كيس', unitPrice: 0.050, totalPrice: 500.000 },
      { id: 'it-12', name: 'أكياس تسوق قماشية فاخرة', quantity: 1600, unit: 'كيس', unitPrice: 0.300, totalPrice: 480.000 }
    ],
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z'
  }
];

export default function OrdersManager({
  branches,
  employees,
  onRefresh
}: OrdersManagerProps) {
  // Main state
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read orders from storage', e);
    }
    return INITIAL_ORDERS;
  });

  // Views & Filters
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'timeline'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'upcoming' | 'delayed' | 'this_month'>('all');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Form State for Create/Edit
  const [formData, setFormData] = useState<Partial<Order>>({
    orderNumber: '',
    title: '',
    type: 'purchase',
    supplierOrCustomer: '',
    branch: branches[0] || 'الرئيسي',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    amount: 0,
    paidAmount: 0,
    status: 'in_progress',
    priority: 'normal',
    paymentStatus: 'unpaid',
    assignedEmployee: employees[0] || '',
    contactPhone: '',
    notes: '',
    items: [
      { id: '1', name: '', quantity: 1, unit: 'حبة', unitPrice: 0, totalPrice: 0 }
    ]
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error('Failed to save orders to localStorage', e);
    }
  }, [orders]);

  // Real-time calculation of days remaining / overdue status
  const getDeliveryStatus = (dueDateStr: string, status: OrderStatus) => {
    if (status === 'delivered') {
      return { label: 'تم التسليم بنجاح', tone: 'delivered', daysDiff: 0 };
    }
    if (status === 'cancelled') {
      return { label: 'ملغاة', tone: 'cancelled', daysDiff: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `متأخرة بـ ${Math.abs(diffDays)} يوم`, tone: 'delayed', daysDiff: diffDays };
    } else if (diffDays === 0) {
      return { label: 'تستحق اليوم ⚠️', tone: 'today', daysDiff: 0 };
    } else if (diffDays === 1) {
      return { label: 'تستحق غداً (باقي يوم)', tone: 'soon', daysDiff: 1 };
    } else {
      return { label: `باقي ${diffDays} أيام`, tone: 'normal', daysDiff: diffDays };
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return orders.filter(order => {
      // Search
      if (searchQuery.trim()) {
        const queryNorm = normalizeArabicSearch(searchQuery);
        const matchTitle = normalizeArabicSearch(order.title).includes(queryNorm);
        const matchNo = normalizeArabicSearch(order.orderNumber).includes(queryNorm);
        const matchParty = normalizeArabicSearch(order.supplierOrCustomer).includes(queryNorm);
        const matchBranch = normalizeArabicSearch(order.branch).includes(queryNorm);
        const matchItems = order.items.some(it => normalizeArabicSearch(it.name).includes(queryNorm));

        if (!matchTitle && !matchNo && !matchParty && !matchBranch && !matchItems) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'delayed') {
          const isOverdue = order.deliveryDueDate < todayStr && order.status !== 'delivered' && order.status !== 'cancelled';
          if (order.status !== 'delayed' && !isOverdue) return false;
        } else if (order.status !== statusFilter) {
          return false;
        }
      }

      // Branch
      if (branchFilter !== 'all' && order.branch !== branchFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && order.type !== typeFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'all' && order.priority !== priorityFilter) {
        return false;
      }

      // Time filter
      if (timeFilter === 'delayed') {
        const isOverdue = order.deliveryDueDate < todayStr && order.status !== 'delivered' && order.status !== 'cancelled';
        if (!isOverdue && order.status !== 'delayed') return false;
      } else if (timeFilter === 'today') {
        if (order.deliveryDueDate !== todayStr) return false;
      } else if (timeFilter === 'upcoming') {
        if (order.deliveryDueDate <= todayStr || order.status === 'delivered' || order.status === 'cancelled') return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, branchFilter, typeFilter, priorityFilter, timeFilter]);

  // Executive KPI stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalCount = orders.length;
    let inProgressCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let delayedCount = 0;
    let dueTodayCount = 0;
    let totalOpenValue = 0;
    let totalPaidValue = 0;

    orders.forEach(o => {
      if (o.status === 'in_progress') inProgressCount++;
      if (o.status === 'shipped') shippedCount++;
      if (o.status === 'delivered') deliveredCount++;

      const isOverdue = o.deliveryDueDate < todayStr && o.status !== 'delivered' && o.status !== 'cancelled';
      if (o.status === 'delayed' || isOverdue) {
        delayedCount++;
      }

      if (o.deliveryDueDate === todayStr && o.status !== 'delivered' && o.status !== 'cancelled') {
        dueTodayCount++;
      }

      if (o.status !== 'delivered' && o.status !== 'cancelled') {
        totalOpenValue += (o.amount || 0);
      }
      totalPaidValue += (o.paidAmount || 0);
    });

    const completionRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;

    return {
      totalCount,
      activeCount: inProgressCount + shippedCount,
      deliveredCount,
      delayedCount,
      dueTodayCount,
      totalOpenValue,
      totalPaidValue,
      completionRate
    };
  }, [orders]);

  // Open Form for creating new order
  const handleOpenCreateModal = () => {
    const nextNum = `ORD-2026-${String(orders.length + 1).padStart(3, '0')}`;
    setFormData({
      orderNumber: nextNum,
      title: '',
      type: 'purchase',
      supplierOrCustomer: '',
      branch: branches[0] || 'الرئيسي',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 0,
      paidAmount: 0,
      status: 'in_progress',
      priority: 'normal',
      paymentStatus: 'unpaid',
      assignedEmployee: employees[0] || '',
      contactPhone: '',
      notes: '',
      items: [
        { id: '1', name: '', quantity: 1, unit: 'حبة', unitPrice: 0, totalPrice: 0 }
      ]
    });
    setEditingOrder(null);
    setIsFormModalOpen(true);
  };

  // Open Form for editing existing order
  const handleOpenEditModal = (order: Order) => {
    setFormData({ ...order, items: order.items && order.items.length > 0 ? [...order.items] : [{ id: '1', name: '', quantity: 1, unit: 'حبة', unitPrice: 0, totalPrice: 0 }] });
    setEditingOrder(order);
    setIsFormModalOpen(true);
  };

  // Add Item row in modal
  const handleAddItemRow = () => {
    const currentItems = formData.items || [];
    setFormData({
      ...formData,
      items: [
        ...currentItems,
        { id: String(Date.now()), name: '', quantity: 1, unit: 'حبة', unitPrice: 0, totalPrice: 0 }
      ]
    });
  };

  // Remove Item row in modal
  const handleRemoveItemRow = (index: number) => {
    const currentItems = [...(formData.items || [])];
    if (currentItems.length <= 1) return;
    currentItems.splice(index, 1);
    
    // Recalculate total amount
    const total = currentItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
    setFormData({
      ...formData,
      items: currentItems,
      amount: total
    });
  };

  // Update item field
  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const currentItems = [...(formData.items || [])];
    const item = { ...currentItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? parseFloat(value) || 0 : currentItems[index].quantity;
      const p = field === 'unitPrice' ? parseFloat(value) || 0 : currentItems[index].unitPrice;
      item.totalPrice = Number((q * p).toFixed(3));
    }

    currentItems[index] = item;
    const total = currentItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0);

    setFormData({
      ...formData,
      items: currentItems,
      amount: total
    });
  };

  // Save Order
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.supplierOrCustomer?.trim()) {
      alert('يرجى كتابة عنوان الطلبية واسم المورد/العميل');
      return;
    }

    const cleanItems = (formData.items || []).filter(it => it.name.trim() !== '');

    const orderToSave: Order = {
      id: editingOrder ? editingOrder.id : `ord-${Date.now()}`,
      orderNumber: formData.orderNumber || `ORD-${Date.now().toString().slice(-4)}`,
      title: formData.title.trim(),
      type: formData.type || 'purchase',
      supplierOrCustomer: formData.supplierOrCustomer.trim(),
      branch: formData.branch || branches[0] || 'الرئيسي',
      orderDate: formData.orderDate || new Date().toISOString().split('T')[0],
      deliveryDueDate: formData.deliveryDueDate || new Date().toISOString().split('T')[0],
      actualDeliveryDate: formData.actualDeliveryDate,
      amount: Number((formData.amount || 0).toFixed(3)),
      paidAmount: Number((formData.paidAmount || 0).toFixed(3)),
      status: formData.status || 'in_progress',
      priority: formData.priority || 'normal',
      paymentStatus: formData.paymentStatus || 'unpaid',
      assignedEmployee: formData.assignedEmployee || '',
      contactPhone: formData.contactPhone || '',
      notes: formData.notes || '',
      items: cleanItems.length > 0 ? cleanItems : [
        { id: '1', name: formData.title, quantity: 1, unit: 'إجمالي', unitPrice: formData.amount || 0, totalPrice: formData.amount || 0 }
      ],
      createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingOrder) {
      setOrders(prev => prev.map(o => o.id === editingOrder.id ? orderToSave : o));
    } else {
      setOrders(prev => [orderToSave, ...prev]);
    }

    setIsFormModalOpen(false);
    setEditingOrder(null);
  };

  // Delete Order
  const handleDeleteOrder = (id: string, title: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الطلبية: "${title}" نهائياً؟`)) {
      setOrders(prev => prev.filter(o => o.id !== id));
      if (selectedOrderDetails?.id === id) {
        setSelectedOrderDetails(null);
      }
    }
  };

  // Quick Status Transition
  const handleQuickStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const update: Partial<Order> = { status: newStatus, updatedAt: new Date().toISOString() };
        if (newStatus === 'delivered' && !o.actualDeliveryDate) {
          update.actualDeliveryDate = new Date().toISOString().split('T')[0];
        }
        return { ...o, ...update };
      }
      return o;
    }));

    if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
      setSelectedOrderDetails(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredOrders.map(o => ({
        'رقم الطلبية': o.orderNumber,
        'عنوان الطلبية': o.title,
        'النوع': getTypeText(o.type),
        'المورد / العميل': o.supplierOrCustomer,
        'الفرع': o.branch,
        'الموظف المسؤول': o.assignedEmployee || 'غير محدد',
        'تاريخ الطلب': o.orderDate,
        'تاريخ الاستحقاق والتسليم': o.deliveryDueDate,
        'تاريخ الاستلام الفعلي': o.actualDeliveryDate || '—',
        'المبلغ الإجمالي (د.ك)': o.amount.toFixed(3),
        'المبلغ المدفوع (د.ك)': o.paidAmount.toFixed(3),
        'المتبقي (د.ك)': (o.amount - o.paidAmount).toFixed(3),
        'الحالة': getStatusText(o.status),
        'الأولوية': getPriorityText(o.priority),
        'حالة الدفع': getPaymentStatusText(o.paymentStatus),
        'عدد البنود': o.items?.length || 0,
        'هاتف التواصل': o.contactPhone || '—',
        'الملاحظات': o.notes || '—'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'جدول متابعة الطلبيات');
      XLSX.writeFile(wb, `كشف_متابعة_الطلبيات_والمواعيد_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel', err);
      alert('حدث خطأ أثناء تصدير ملف Excel');
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    const el = document.getElementById('printable-orders-schedule');
    if (!el) {
      alert('لم يتم العثور على جدول الطلبيات للتحميل');
      return;
    }

    setPdfLoading(true);
    try {
      await exportElementToPDF(el, {
        filename: `كشف_الطلبيات_ومواعيد_التسليم_${new Date().toISOString().split('T')[0]}.pdf`,
        orientation: 'landscape',
        margins: 'narrow',
        scale: 100
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (window.confirm('تعذر التحميل المباشر لملف PDF. هل تود فتح نافذة الطباعة للحفظ بصيغة PDF فوراً؟')) {
        window.print();
      }
    } finally {
      setPdfLoading(false);
    }
  };

  // Helper Labels & Styles
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"><Clock size={12}/> قيد المراجعة</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1"><Package size={12}/> قيد التجهيز</span>;
      case 'shipped':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1"><Truck size={12}/> في الطريق</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><CheckCircle2 size={12}/> تم الاستلام</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><X size={12}/> ملغاة</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: OrderPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">عاجل جداً 🔥</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">مرتفع ⚡</span>;
      case 'normal':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">عادي</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-200">منخفض</span>;
    }
  };

  const getTypeText = (type: OrderType) => {
    switch (type) {
      case 'purchase': return 'مشتريات وتوريد';
      case 'supply': return 'خامات ومواد أولية';
      case 'customer': return 'طلبية عميل';
      case 'branch_transfer': return 'تحويل بين الفروع';
    }
  };

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'in_progress': return 'قيد التجهيز';
      case 'shipped': return 'في الطريق';
      case 'delivered': return 'تم الاستلام';
      case 'cancelled': return 'ملغاة';
    }
  };

  const getPriorityText = (priority: OrderPriority) => {
    switch (priority) {
      case 'urgent': return 'عاجل جداً';
      case 'high': return 'مرتفع';
      case 'normal': return 'عادي';
      case 'low': return 'منخفض';
    }
  };

  const getPaymentStatusText = (status: PaymentStatus) => {
    switch (status) {
      case 'paid': return 'مدفوع بالكامل';
      case 'partial': return 'مدفوع جزئياً';
      case 'unpaid': return 'آجل / غير مدفوع';
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
            <Truck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                متابعة الطلبيات ومواعيد الاستحقاق
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200">
                {orders.length} طلبية
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1">
              جدولة ومتابعة طلبيات التوريد، المشتريات، والعملاء وتتبع مواعيد التسليم الفعلي والتأخيرات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add New Order Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة طلبية جديدة</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 text-xs font-black rounded-xl transition-all cursor-pointer"
            title="تصدير جدول الطلبيات إلى Excel"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">تصدير Excel</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-black rounded-xl transition-all cursor-pointer disabled:opacity-60"
            title="تصدير كشف المواعيد بصيغة PDF"
          >
            {pdfLoading ? <Loader2 size={15} className="animate-spin text-rose-600" /> : <FileDown size={15} />}
            <span className="hidden sm:inline">تصدير PDF</span>
          </button>

          {/* Quick Print */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm"
            title="طباعة كشف الطلبيات"
          >
            <Printer size={15} />
            <span>طباعة</span>
          </button>
        </div>
      </div>

      {/* Urgent Schedule Countdown & Alerts Bar */}
      {(stats.delayedCount > 0 || stats.dueTodayCount > 0) && (
        <div className="no-print bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 animate-bounce">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-rose-900 flex items-center gap-2">
                تنبيه رادار مواعيد التسليم الفورية
                {stats.delayedCount > 0 && (
                  <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] rounded-md font-mono">
                    {stats.delayedCount} طلبيات متأخرة!
                  </span>
                )}
                {stats.dueTodayCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-600 text-white text-[10px] rounded-md font-mono">
                    {stats.dueTodayCount} تستحق اليوم
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-600 font-bold mt-0.5">
                يرجى متابعة الموردين ومسؤولي الفروع لتأكيد الاستلام وإغلاق أوامر التوريد المعلقة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => {
                setStatusFilter('delayed');
                setTimeFilter('delayed');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
            >
              عرض المتأخرة فوراً
            </button>
            <button
              onClick={() => {
                setStatusFilter('all');
                setTimeFilter('today');
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer"
            >
              طلبيات اليوم
            </button>
          </div>
        </div>
      )}

      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Active Orders */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">طلبيات نشطة (قيد التنفيذ)</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black font-mono text-slate-900">{stats.activeCount}</span>
              <span className="text-xs text-slate-400 font-bold">من أصل {stats.totalCount}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-black text-blue-600">
              <Package size={13} />
              <span>مفتوحة وقيد التوصيل</span>
            </div>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Package size={24} />
          </div>
        </div>

        {/* Delayed & Due Today */}
        <div className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all ${
          stats.delayedCount > 0 ? 'bg-rose-50/50 border-rose-200 text-rose-950' : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">طلبيات متأخرة أو تستحق اليوم</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black font-mono text-rose-600">{stats.delayedCount + stats.dueTodayCount}</span>
              <span className="text-xs text-slate-400 font-bold">طلبية حرجة</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-black text-rose-600">
              <AlertTriangle size={13} />
              <span>{stats.delayedCount} متأخرة • {stats.dueTodayCount} اليوم</span>
            </div>
          </div>
          <div className="p-3.5 bg-rose-100 text-rose-600 rounded-2xl border border-rose-200">
            <CalendarClock size={24} />
          </div>
        </div>

        {/* Open Value in KWD */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">قيمة الطلبيات المفتوحة</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-2xl font-black font-mono text-emerald-700">{formatKWD(stats.totalOpenValue)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] font-black text-emerald-600">
              <DollarSign size={13} />
              <span>تم سداد: {formatKWD(stats.totalPaidValue)}</span>
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Delivery Completion Rate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">نسبة الاستلام والتسليم</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black font-mono text-slate-900">{stats.completionRate}%</span>
              <span className="text-xs text-emerald-600 font-bold">{stats.deliveredCount} مستلمة</span>
            </div>
            <div className="w-28 h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* Filter and View Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث برقم الطلبية، اسم المورد/العميل، الفرع، أو البند..."
              className="w-full pl-4 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered size={14} />
              <span>جدول مفصل</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban size={14} />
              <span>مراحل العمل (كانبان)</span>
            </button>

            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarClock size={14} />
              <span>الجدول الزمني</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1">حالة الطلبية:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="all">كل الحالات ({orders.length})</option>
              <option value="in_progress">قيد التجهيز</option>
              <option value="shipped">في الطريق</option>
              <option value="delivered">تم الاستلام</option>
              <option value="delayed">متأخرة عن الموعد</option>
              <option value="pending">قيد المراجعة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1">الفرع المستهدف:</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="all">كافة الفروع</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1">نوع الطلبية:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="all">كافة الأنواع</option>
              <option value="purchase">مشتريات وتوريد</option>
              <option value="supply">خامات ومواد أولية</option>
              <option value="customer">طلبية عميل</option>
              <option value="branch_transfer">تحويل بين الفروع</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1">الأولوية:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="all">كل الأولويات</option>
              <option value="urgent">عاجل جداً 🔥</option>
              <option value="high">مرتفع ⚡</option>
              <option value="normal">عادي</option>
              <option value="low">منخفض</option>
            </select>
          </div>

          {/* Schedule Window Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1">نافذة الموعد:</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              <option value="all">كافة المواعيد</option>
              <option value="today">تستحق اليوم</option>
              <option value="upcoming">قادمة مستقبلاً</option>
              <option value="delayed">متأخرة فقط</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DETAILED TABLE VIEW (الجدول المفصل والطباعة الرسمية) */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div id="printable-orders-schedule" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
          {/* Printable Header (Visible on print) */}
          <div className="hidden print:block p-6 border-b-2 border-slate-900 mb-4 text-center">
            <h2 className="text-xl font-black text-slate-900">تقرير ومحضر جدول متابعة الطلبيات ومواعيد الاستحقاق</h2>
            <p className="text-xs text-slate-600 mt-1">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-KW')} • إجمالي الطلبيات المعروضة: {filteredOrders.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black text-[11px] border-b border-slate-800">
                  <th className="py-4 px-4">رقم الطلبية</th>
                  <th className="py-4 px-4">عنوان وبيان الطلبية</th>
                  <th className="py-4 px-4">المورد / العميل</th>
                  <th className="py-4 px-4">الفرع والمسؤول</th>
                  <th className="py-4 px-4 text-center">تاريخ الطلب</th>
                  <th className="py-4 px-4 text-center">موعد الاستحقاق</th>
                  <th className="py-4 px-4 text-left">المبلغ (د.ك)</th>
                  <th className="py-4 px-4 text-center">حالة التسليم</th>
                  <th className="py-4 px-4 text-center no-print">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Package size={36} className="mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-sm">لا توجد طلبيات مطابقة لمعايير البحث والتصفية</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const dueInfo = getDeliveryStatus(order.deliveryDueDate, order.status);
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        } ${dueInfo.tone === 'delayed' ? 'border-r-4 border-r-rose-500' : dueInfo.tone === 'today' ? 'border-r-4 border-r-amber-500' : ''}`}
                      >
                        {/* Order Number & Priority */}
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                          <div className="flex flex-col gap-1">
                            <span className="text-emerald-700 font-bold">{order.orderNumber}</span>
                            {getPriorityBadge(order.priority)}
                          </div>
                        </td>

                        {/* Title & Items Summary */}
                        <td className="py-3.5 px-4">
                          <p className="font-black text-slate-900">{order.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">{getTypeText(order.type)}</span>
                            <span>• {order.items?.length || 0} بنود/أصناف</span>
                          </div>
                        </td>

                        {/* Supplier / Customer */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{order.supplierOrCustomer}</p>
                          {order.contactPhone && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{order.contactPhone}</p>
                          )}
                        </td>

                        {/* Branch & Assigned Employee */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span>{order.branch}</span>
                          </div>
                          {order.assignedEmployee && (
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <User size={11} className="text-slate-400" />
                              <span>{order.assignedEmployee}</span>
                            </p>
                          )}
                        </td>

                        {/* Order Date */}
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                          {order.orderDate}
                        </td>

                        {/* Delivery Due Date & Countdown Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-black text-slate-900 block">{order.deliveryDueDate}</span>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                            dueInfo.tone === 'delayed'
                              ? 'bg-rose-100 text-rose-800 font-black'
                              : dueInfo.tone === 'today'
                              ? 'bg-amber-100 text-amber-900 font-black animate-pulse'
                              : dueInfo.tone === 'soon'
                              ? 'bg-blue-100 text-blue-800'
                              : dueInfo.tone === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {dueInfo.label}
                          </span>
                        </td>

                        {/* Amount & Paid Status */}
                        <td className="py-3.5 px-4 text-left font-mono">
                          <span className="font-black text-slate-900 text-sm">{formatKWD(order.amount)}</span>
                          <span className={`block text-[10px] font-bold mt-0.5 ${
                            order.paymentStatus === 'paid' ? 'text-emerald-600' : order.paymentStatus === 'partial' ? 'text-amber-600' : 'text-slate-400'
                          }`}>
                            {getPaymentStatusText(order.paymentStatus)}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(order.status)}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-center no-print">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="عرض التفاصيل والأصناف"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditModal(order)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل بيانات الطلبية"
                            >
                              <Edit size={15} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteOrder(order.id, order.title)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف الطلبية"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: KANBAN PIPELINE VIEW (لوحة متابعة تدفق المراحل) */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 no-print">
          {(['pending', 'in_progress', 'shipped', 'delivered'] as OrderStatus[]).map((colStatus) => {
            const colOrders = filteredOrders.filter(o => o.status === colStatus);
            const colTotal = colOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

            const colConfig = {
              pending: { title: 'قيد المراجعة والاعتماد', color: 'bg-slate-100 text-slate-800 border-slate-200' },
              in_progress: { title: 'قيد التجهيز والتنفيذ', color: 'bg-blue-50 text-blue-800 border-blue-200' },
              shipped: { title: 'في الطريق وقيد الشحن', color: 'bg-amber-50 text-amber-800 border-amber-200' },
              delivered: { title: 'تم الاستلام والتسليم ✅', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
              cancelled: { title: 'ملغاة', color: 'bg-rose-50 text-rose-800 border-rose-200' }
            }[colStatus];

            return (
              <div key={colStatus} className="bg-slate-50/70 p-4 rounded-3xl border border-slate-200 flex flex-col min-h-[500px]">
                {/* Column Header */}
                <div className={`p-3.5 rounded-2xl border mb-3 flex items-center justify-between ${colConfig.color}`}>
                  <div>
                    <h3 className="text-xs font-black">{colConfig.title}</h3>
                    <p className="text-[10px] opacity-80 mt-0.5 font-mono">{formatKWD(colTotal)}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-white rounded-full text-xs font-black shadow-2xs font-mono">
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
                  {colOrders.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs font-bold border-2 border-dashed border-slate-200 rounded-2xl">
                      لا توجد طلبيات بهذه المرحلة
                    </div>
                  ) : (
                    colOrders.map(order => {
                      const dueInfo = getDeliveryStatus(order.deliveryDueDate, order.status);
                      return (
                        <div
                          key={order.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              {order.orderNumber}
                            </span>
                            {getPriorityBadge(order.priority)}
                          </div>

                          <div>
                            <h4 className="text-xs font-black text-slate-900 leading-snug">{order.title}</h4>
                            <p className="text-[11px] text-slate-600 font-bold mt-1 flex items-center gap-1">
                              <Building2 size={12} className="text-slate-400" />
                              <span>{order.branch}</span> • <span>{order.supplierOrCustomer}</span>
                            </p>
                          </div>

                          {/* Due Date & Countdown */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">موعد الاستحقاق:</span>
                            <span className={`font-mono font-black px-2 py-0.5 rounded ${
                              dueInfo.tone === 'delayed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {order.deliveryDueDate}
                            </span>
                          </div>

                          {/* Amount & Items */}
                          <div className="flex items-center justify-between text-xs font-bold pt-1">
                            <span className="font-mono font-black text-slate-900">{formatKWD(order.amount)}</span>
                            <span className="text-[10px] text-slate-400">{order.items?.length || 0} أصناف</span>
                          </div>

                          {/* Quick Stage Progression Buttons */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="text-slate-600 hover:text-slate-900 font-black cursor-pointer"
                            >
                              التفاصيل
                            </button>

                            <div className="flex items-center gap-1">
                              {colStatus === 'pending' && (
                                <button
                                  onClick={() => handleQuickStatusChange(order.id, 'in_progress')}
                                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-blue-700"
                                >
                                  بدء التجهيز ←
                                </button>
                              )}
                              {colStatus === 'in_progress' && (
                                <button
                                  onClick={() => handleQuickStatusChange(order.id, 'shipped')}
                                  className="px-2 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-amber-700"
                                >
                                  شحن / توصيل ←
                                </button>
                              )}
                              {colStatus === 'shipped' && (
                                <button
                                  onClick={() => handleQuickStatusChange(order.id, 'delivered')}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-emerald-700"
                                >
                                  تأكيد الاستلام ✅
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TIMELINE & SCHEDULE CALENDAR VIEW (الجدول الزمني ومواعيد الاستحقاق) */}
      {/* ========================================================================= */}
      {viewMode === 'timeline' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 no-print">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">الجدول الزمني للطلبيات حسب مواعيد الاستحقاق والتسليم</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">مرتبة تسلسلياً من الأقرب استحقاقاً إلى الأبعد</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-black">
              {filteredOrders.length} طلبية في الجدول
            </span>
          </div>

          {/* Timeline Stream */}
          <div className="relative border-r-2 border-slate-200 pr-6 space-y-6 mr-3">
            {filteredOrders
              .sort((a, b) => a.deliveryDueDate.localeCompare(b.deliveryDueDate))
              .map((order) => {
                const dueInfo = getDeliveryStatus(order.deliveryDueDate, order.status);
                return (
                  <div key={order.id} className="relative group">
                    {/* Node Dot */}
                    <div className={`absolute -right-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-xs ${
                      dueInfo.tone === 'delayed'
                        ? 'bg-rose-600'
                        : dueInfo.tone === 'today'
                        ? 'bg-amber-500 ring-4 ring-amber-200'
                        : order.status === 'delivered'
                        ? 'bg-emerald-600'
                        : 'bg-blue-600'
                    }`} />

                    {/* Timeline Item Card */}
                    <div className="bg-slate-50 hover:bg-slate-100/80 p-5 rounded-2xl border border-slate-200/80 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            {order.orderNumber}
                          </span>
                          <h4 className="text-sm font-black text-slate-900">{order.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                            dueInfo.tone === 'delayed' ? 'bg-rose-100 text-rose-800' : dueInfo.tone === 'today' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {dueInfo.label} ({order.deliveryDueDate})
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 font-bold mb-3">
                        الطرف الآخر: <span className="text-slate-900 font-black">{order.supplierOrCustomer}</span> • الفرع: <span className="text-slate-900 font-black">{order.branch}</span> • المسؤول: <span className="text-slate-900 font-black">{order.assignedEmployee || '—'}</span>
                      </p>

                      {/* Items Pill List */}
                      {order.items && order.items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] font-black text-slate-400">الأصناف:</span>
                          {order.items.map((it, iIdx) => (
                            <span key={iIdx} className="px-2 py-0.5 bg-white text-slate-700 rounded-md text-[10px] font-bold border border-slate-200">
                              {it.name} ({it.quantity} {it.unit})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT ORDER (نافذة إضافة وتعديل الطلبية) */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white max-w-3xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 rounded-xl">
                  <Package size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingOrder ? 'تعديل بيانات الطلبية وموعد الاستحقاق' : 'إضافة طلبية وموعد تسليم جديد'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">تسجيل تفاصيل أمر الشراء أو التوريد والجدول الزمني</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveOrder} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Order Number */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">رقم الطلبية / الكود:</label>
                  <input
                    type="text"
                    required
                    value={formData.orderNumber || ''}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 font-mono"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">نوع الطلبية:</label>
                  <select
                    value={formData.type || 'purchase'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  >
                    <option value="purchase">مشتريات وتوريد بضاعة</option>
                    <option value="supply">خامات ومواد أولية</option>
                    <option value="customer">طلبية عميل / بيع</option>
                    <option value="branch_transfer">تحويل ومناقلة بين الفروع</option>
                  </select>
                </div>

                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 mb-1">عنوان وبيان الطلبية الرئيسي:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: توريد شحنة زهور هولندية، كراتين شحن مقاس A3..."
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {/* Supplier / Customer */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">اسم المورد / العميل / الطرف الآخر:</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الشركة أو العميل..."
                    value={formData.supplierOrCustomer || ''}
                    onChange={(e) => setFormData({ ...formData, supplierOrCustomer: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">هاتف المندوب / للتواصل:</label>
                  <input
                    type="text"
                    placeholder="+965 ..."
                    value={formData.contactPhone || ''}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono"
                  />
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">الفرع المستلم / المعني:</label>
                  <select
                    value={formData.branch || branches[0]}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  >
                    {branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned Employee */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">الموظف المسؤول / مسؤول العهدة:</label>
                  <select
                    value={formData.assignedEmployee || ''}
                    onChange={(e) => setFormData({ ...formData, assignedEmployee: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  >
                    <option value="">-- اختياري --</option>
                    {employees.map(emp => (
                      <option key={emp} value={emp}>{emp}</option>
                    ))}
                  </select>
                </div>

                {/* Order Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">تاريخ الطلب / الإصدار:</label>
                  <input
                    type="date"
                    required
                    value={formData.orderDate || ''}
                    onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 font-mono"
                  />
                </div>

                {/* Delivery Due Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">موعد الاستحقاق والتسليم المتوقع 📅:</label>
                  <input
                    type="date"
                    required
                    value={formData.deliveryDueDate || ''}
                    onChange={(e) => setFormData({ ...formData, deliveryDueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 font-mono"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">درجة الأولوية:</label>
                  <select
                    value={formData.priority || 'normal'}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  >
                    <option value="urgent">عاجل جداً 🔥</option>
                    <option value="high">مرتفع ⚡</option>
                    <option value="normal">عادي</option>
                    <option value="low">منخفض</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">حالة الطلبية الحالية:</label>
                  <select
                    value={formData.status || 'in_progress'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  >
                    <option value="pending">قيد المراجعة والاعتماد</option>
                    <option value="in_progress">قيد التجهيز والتنفيذ</option>
                    <option value="shipped">في الطريق وقيد الشحن</option>
                    <option value="delivered">تم الاستلام والتسليم</option>
                    <option value="cancelled">ملغاة</option>
                  </select>
                </div>
              </div>

              {/* Items Table Builder */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Package size={14} className="text-emerald-600" />
                    <span>جدول بنود وأصناف الطلبية</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-black hover:bg-emerald-100 cursor-pointer"
                  >
                    + إضافة صنف
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(formData.items || []).map((item, idx) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="col-span-5">
                        <input
                          type="text"
                          placeholder="اسم الصنف / البند..."
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="الكمية"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="الوحدة"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.001"
                          placeholder="السعر"
                          value={item.unitPrice || ''}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-left font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals & Payments */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">المبلغ الإجمالي (د.ك):</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black font-mono text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">المبلغ المدفوع (د.ك):</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.paidAmount || ''}
                    onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black font-mono text-blue-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">حالة السداد والدفع:</label>
                  <select
                    value={formData.paymentStatus || 'unpaid'}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                  >
                    <option value="unpaid">آجل / غير مدفوع</option>
                    <option value="partial">دفعة مقدمة / جزئي</option>
                    <option value="paid">مدفوع بالكامل</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">ملاحظات وتعليمات التسليم والفحص:</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل تخص مكان التسليم، شروط الفحص، أو اسم مندوب التوصيل..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {editingOrder ? 'حفظ التعديلات' : 'إضافة الطلبية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ORDER DETAILS DRAWER / MODAL (عرض تفاصيل الطلبية وتحديث حالتها) */}
      {/* ========================================================================= */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  {selectedOrderDetails.orderNumber}
                </span>
                <h3 className="text-base font-black mt-1">{selectedOrderDetails.title}</h3>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Key Meta Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-black text-slate-400">الطرف الآخر:</span>
                  <p className="font-black text-slate-900 mt-0.5">{selectedOrderDetails.supplierOrCustomer}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400">الفرع:</span>
                  <p className="font-black text-slate-900 mt-0.5">{selectedOrderDetails.branch}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400">المسؤول:</span>
                  <p className="font-black text-slate-900 mt-0.5">{selectedOrderDetails.assignedEmployee || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400">تاريخ الطلب:</span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">{selectedOrderDetails.orderDate}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400">موعد الاستحقاق:</span>
                  <p className="font-mono font-black text-rose-700 mt-0.5">{selectedOrderDetails.deliveryDueDate}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400">الحالة الحالية:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedOrderDetails.status)}</div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-black text-slate-900 mb-2">قائمة البنود والأصناف:</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-slate-100 text-[10px] font-black text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">الصنف</th>
                        <th className="p-2.5 text-center">الكمية</th>
                        <th className="p-2.5 text-left">السعر</th>
                        <th className="p-2.5 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(selectedOrderDetails.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-bold text-slate-800">{it.name}</td>
                          <td className="p-2.5 text-center">{it.quantity} {it.unit}</td>
                          <td className="p-2.5 text-left">{it.unitPrice.toFixed(3)}</td>
                          <td className="p-2.5 text-left font-black text-slate-900">{it.totalPrice.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <div>
                  <span className="text-[10px] font-black text-emerald-800">إجمالي قيمة الطلبية:</span>
                  <p className="text-base font-black font-mono text-emerald-950">{formatKWD(selectedOrderDetails.amount)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-800">المدفوع:</span>
                  <p className="text-base font-black font-mono text-emerald-950">{formatKWD(selectedOrderDetails.paidAmount)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black text-emerald-800">المتبقي:</span>
                  <p className="text-base font-black font-mono text-rose-700">
                    {formatKWD(selectedOrderDetails.amount - selectedOrderDetails.paidAmount)}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {selectedOrderDetails.notes && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 block mb-1">الملاحظات:</span>
                  <p className="font-bold text-slate-700 leading-relaxed">{selectedOrderDetails.notes}</p>
                </div>
              )}

              {/* Quick Status Update Bar */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-600">تحديث مرحلة الطلبية:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickStatusChange(selectedOrderDetails.id, 'in_progress')}
                    className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-black transition-colors"
                  >
                    قيد التجهيز
                  </button>
                  <button
                    onClick={() => handleQuickStatusChange(selectedOrderDetails.id, 'shipped')}
                    className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl font-black transition-colors"
                  >
                    في الطريق
                  </button>
                  <button
                    onClick={() => handleQuickStatusChange(selectedOrderDetails.id, 'delivered')}
                    className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-black transition-colors shadow-xs"
                  >
                    تم الاستلام ✅
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
