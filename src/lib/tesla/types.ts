export interface TeslaApiResponse<T> {
  response: T;
  error?: string;
  error_description?: string;
}

export interface VehicleListItem {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string | null;
  state: 'online' | 'offline' | 'asleep';
  access_type?: string;
}

export interface VehicleConfig {
  car_type?: string;
  model?: string;
  exterior_color?: string;
  trim_badging?: string;
}

export interface ChargeState {
  battery_level: number;
  battery_range: number;
  charging_state: string;
  charge_limit_soc: number;
  charge_port_door_open?: boolean;
  time_to_full_charge?: number;
}

export interface ClimateState {
  inside_temp: number | null;
  outside_temp: number | null;
  is_climate_on: boolean;
  driver_temp_setting: number;
  passenger_temp_setting: number;
  fan_status: number;
}

export interface DriveState {
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  power: number | null;
}

export interface VehicleState {
  locked: boolean;
  odometer: number;
  car_version: string;
  sentry_mode: boolean;
  fd_window: number;
  fp_window: number;
  rd_window: number;
  rp_window: number;
}

export interface VehicleData {
  id: number;
  vin: string;
  display_name: string | null;
  state: string;
  charge_state?: ChargeState;
  climate_state?: ClimateState;
  drive_state?: DriveState;
  vehicle_state?: VehicleState;
  vehicle_config?: VehicleConfig;
}

export interface FleetStatusItem {
  vin: string;
  is_key_paired: boolean;
  firmware_version: string;
  vehicle_command_protocol_required: boolean;
  discounted_device_data: boolean;
  fleet_telemetry_version: string;
}

export interface FleetStatusResponse {
  response: {
    key_paired_vins: string[];
    unpaired_vins: string[];
    vehicle_info: Record<string, FleetStatusItem>;
  };
}

export interface UserMe {
  email: string;
  full_name: string;
}
