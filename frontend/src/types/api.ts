export type Role = 1 | 2 | 3
export type RepairStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type NotificationStatus =
  | 'pending'
  | 'processing'
  | 'simulated'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled'
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
export interface Shop {
  id: number
  title: string
  is_active: boolean
  created_at: string
}
export interface Staff {
  id: number
  username: string
  email: string
  role: Role | null
  role_display: string
  repair_shop: Shop | null
  is_staff: boolean
  is_active: boolean
  date_joined: string
  last_login: string | null
}
export interface Me {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  role: Role | null
  role_display: string
  repair_shop: Shop | null
  is_active: boolean
}
export interface Customer {
  id: number
  name: string
  phone_number: string
  available_phone_number: string
  repair_shop: Shop
  created_at: string
}
export interface DeviceModel {
  id: number
  brand: { id: number; name: string }
  name: string
  search_aliases: string
  is_active: boolean
}
export interface Device {
  id: number
  customer: Customer
  device_model: DeviceModel | null
  custom_model_name: string
  created_at: string
}
export interface PublicRepair {
  id: number
  tracking_code: string
  repair_status: RepairStatus
  repair_status_display: string
  final_amount: number | null
  is_paid: boolean
  created_at: string
}
export interface Repair extends PublicRepair {
  repair_shop: Shop
  customer: Customer
  device: Device
  assigned_technician: Staff | null
  issue_description: string
  paid_at: string | null
  received_at: string | null
}
export interface RepairHistory {
  id: number
  repair_previous_status: RepairStatus
  previous_status_display: string
  repair_new_status: RepairStatus
  new_status_display: string
  modifier_name: string
  modified_at: string
}
export interface Notification {
  id: number
  repair_order_id: number | null
  customer_id: number | null
  customer_name: string | null
  tracking_code: string | null
  event_type: string
  channel: 'sms' | 'whatsapp'
  channel_display: string
  provider: 'fake' | 'smsir' | 'kavenegar'
  provider_display: string
  recipient: string
  template_key: string
  rendered_message: string
  status: NotificationStatus
  status_display: string
  attempt_count: number
  is_retryable: boolean
  error_code: string
  last_error: string
  scheduled_at: string
  sent_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}
export interface CustomerRepairHistory extends PublicRepair {
  device_name: string
  issue_description: string
  paid_at: string | null
  technician_name: string | null
}
export interface DashboardSummary {
  orders: {
    total: number
    active: number
    ready_for_delivery: number
    unpaid: number
    today: number
  }
  revenue: { total_paid_amount: number; today_paid_amount: number }
  status_counts: Record<
    | 'initial'
    | 'inspecting'
    | 'waiting_for_parts'
    | 'repairing'
    | 'ready_for_delivery'
    | 'delivered'
    | 'cancelled',
    number
  >
}
export interface NewCustomer {
  name: string
  phone_number: string
  available_phone_number?: string
}
export interface NewDevice {
  device_model?: number | null
  custom_model_name?: string
}
export interface CreateRepair {
  customer_id?: number
  new_customer?: NewCustomer
  device_id?: number
  new_device?: NewDevice
  assigned_technician_id?: number | null
  issue_description: string
  final_amount: number | null
  is_paid: boolean
}
export interface UpdateRepair {
  assigned_technician_id?: number | null
  repair_status?: RepairStatus
  final_amount?: number | null
  is_paid?: boolean
  issue_description?: string
  receive_now?: true
  received_at?: string | null
}
export interface StaffInput {
  username: string
  email: string
  role: Role
  is_active: boolean
  password?: string
  new_password?: string
}
export type StaffUpdateResponse = Pick<Staff, 'username' | 'email' | 'role' | 'is_active'> & {
  first_name: string
  last_name: string
}
