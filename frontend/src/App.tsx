/**
 * Main React application for ConRen.
 *
 * Beginner note:
 * This file currently contains most of the frontend application in one place.
 * That includes data types, reusable components, dashboards, booking flows,
 * payment UI, and top-level screen switching.
 *
 * In a larger app, this would usually be split into many smaller files.
 *
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  User, 
  LogOut, 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Star,
  ChevronRight,
  LayoutDashboard,
  Package,
  History,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
// These interfaces describe the shape of data the frontend expects from the API.
interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'RENTER' | 'ADMIN';
  is_approved: number;
  id_proof?: string;
  shop_credentials?: string;
}

interface Machine {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  location: string;
  price_per_hour: number;
  image_url: string;
  description: string;
}

interface Booking {
  id: string;
  machine_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  actual_end_date?: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  total_cost: number;
  initial_paid: number;
  final_paid: number;
  extra_cost: number;
  machine_name?: string;
  renter_name?: string;
}

interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface AuthSession {
  token: string;
  user: User;
}

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

const getStoredToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const clearStoredSession = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const apiFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {});
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

const getInitialPaymentAmount = (totalCost: number) => Math.ceil(totalCost / 2);
const getFinalPaymentAmount = (totalCost: number, extraCost: number) =>
  totalCost - getInitialPaymentAmount(totalCost) + extraCost;

// --- Components ---
// The app UI is built from React components. Each component below is a piece
// of the overall interface.

// Top navigation bar shown across the app.
const Navbar: React.FC<{ user: User | null, onLogout: () => void, onNavigate: (view: string) => void }> = ({ user, onLogout, onNavigate }) => (
  <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16 items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Truck className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900">Conren</span>
        </div>
        
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <div className="flex items-center gap-3 pl-6 border-l border-zinc-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-zinc-900">{user.name}</p>
                  <p className="text-xs text-zinc-500">{user.role}</p>
                </div>
                <button 
                  onClick={onLogout}
                  className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => onNavigate('auth')}
              className="bg-zinc-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  </nav>
);

// Login and signup screen.
const AuthPage: React.FC<{ onLogin: (session: AuthSession) => void }> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'RENTER' as const,
    id_proof: '',
    shop_credentials: ''
  });
  const [error, setError] = useState('');

  // Submit either a login request or a signup request depending on the mode.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) onLogin(data);
      else setError(data.detail || data.error || 'Something went wrong. Please try again.');
    } catch (err) {
      setError('Could not connect to server. Please make sure the backend is running.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-zinc-900 mb-6">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <form onSubmit={handleSubmit} className="space-gap-4 flex flex-col gap-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">I want to...</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as any})}
                >
                  <option value="RENTER">Rent Machines</option>
                  <option value="OWNER">List My Machines</option>
                </select>
              </div>
              {formData.role === 'OWNER' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Valid ID Number</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={formData.id_proof}
                      onChange={e => setFormData({...formData, id_proof: e.target.value})}
                      placeholder="e.g. Aadhar / PAN / License"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Shop Credentials / License</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={formData.shop_credentials}
                      onChange={e => setFormData({...formData, shop_credentials: e.target.value})}
                      placeholder="Shop Registration Number"
                    />
                  </div>
                </>
              )}
            </>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors mt-2">
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500 mt-6">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-emerald-600 font-semibold hover:underline">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

// Reusable machine card used in lists and dashboards.
const MachineCard: React.FC<{ machine: Machine, onBook?: (m: Machine) => void }> = ({ machine, onBook }) => (
  <motion.div 
    layout
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow group"
  >
    <div className="aspect-video relative overflow-hidden">
      <img 
        src={machine.image_url || `https://picsum.photos/seed/${machine.id}/600/400`} 
        alt={machine.name}
        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-zinc-900 border border-zinc-200">
        {machine.category}
      </div>
    </div>
    <div className="p-4">
      <h3 className="text-lg font-bold text-zinc-900 mb-1">{machine.name}</h3>
      <div className="flex items-center gap-1 text-zinc-500 text-sm mb-3">
        <MapPin className="w-3 h-3" />
        {machine.location}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
        <div>
          <span className="text-xl font-bold text-emerald-600">₹{machine.price_per_hour}</span>
          <span className="text-zinc-500 text-xs ml-1">/ hr</span>
        </div>
        {onBook && (
          <button 
            onClick={() => onBook(machine)}
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            Book Now
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

// Notification panel that periodically checks the backend for updates.
const NotificationList: React.FC<{ userId: string }> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    const res = await apiFetch(`/api/notifications/${userId}`);
    setNotifications(await res.json());
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  if (notifications.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mb-6">
      <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notifications</h3>
        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {notifications.filter(n => !n.is_read).length} New
        </span>
      </div>
      <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
        {notifications.map(n => (
          <div key={n.id} className={`p-3 text-sm ${n.is_read ? 'opacity-60' : 'bg-emerald-50/30'}`}>
            <p className="text-zinc-800">{n.message}</p>
            <p className="text-[10px] text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Dashboard shown to approved machine owners.
const OwnerDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMachine, setNewMachine] = useState({
    name: '', category: 'Excavator', location: '', price_per_hour: 0, image_url: '', description: ''
  });

  // Load the owner's machines and related bookings.
  const fetchData = async () => {
    const [mRes, bRes] = await Promise.all([
      apiFetch(`/api/machines/owner/${user.id}`),
      apiFetch(`/api/bookings/owner/${user.id}`)
    ]);
    setMachines(await mRes.json());
    setBookings(await bRes.json());
  };

  useEffect(() => { fetchData(); }, []);

  // Create a new machine listing and refresh the dashboard.
  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newMachine, owner_id: user.id })
    });
    setShowAdd(false);
    fetchData();
  };

  // Update the booking status after owner actions.
  const updateBookingStatus = async (id: string, status: string) => {
    await apiFetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Owner Portal</h1>
          <p className="text-zinc-500">Manage your fleet and bookings</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5" />
          Add Machine
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <NotificationList userId={user.id} />
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-bold text-zinc-900">My Garage</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {machines.map(m => <MachineCard key={m.id} machine={m} />)}
              {machines.length === 0 && (
                <div className="col-span-full py-12 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-zinc-400">
                  <Truck className="w-12 h-12 mb-2 opacity-20" />
                  <p>No machines listed yet</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-bold text-zinc-900">Booking Requests & Payments</h2>
            </div>
            <div className="space-y-4">
              {bookings.map(b => (
                <div key={b.id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-zinc-900">{b.machine_name}</h4>
                      <p className="text-xs text-zinc-500">Renter: {b.renter_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                      b.status === 'COMPLETED' ? 'bg-zinc-100 text-zinc-700' :
                      b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  
                  <div className="text-xs text-zinc-600 space-y-1 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {b.start_date} to {b.end_date}
                    </div>
                    <div className="flex items-center justify-between font-bold text-zinc-900 pt-2 border-t border-zinc-50">
                      <span>Total Value:</span>
                      <span>₹{b.total_cost + b.extra_cost}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2 text-[10px] font-bold">
                      <div className={`flex-1 p-2 rounded border ${b.initial_paid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                        Initial 50%: {b.initial_paid ? 'RECEIVED' : 'PENDING'}
                      </div>
                      <div className={`flex-1 p-2 rounded border ${b.final_paid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                        Final: {b.final_paid ? 'RECEIVED' : 'PENDING'}
                      </div>
                    </div>

                    {b.status === 'PENDING' && (
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => updateBookingStatus(b.id, 'CONFIRMED')}
                          className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => updateBookingStatus(b.id, 'CANCELLED')}
                          className="flex-1 bg-zinc-100 text-zinc-600 py-1.5 rounded-lg text-sm font-bold hover:bg-zinc-200"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="text-zinc-400 text-sm text-center py-8">No bookings yet</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-zinc-900">Add New Machine</h2>
                <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-zinc-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddMachine} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Machine Name</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newMachine.name}
                      onChange={e => setNewMachine({...newMachine, name: e.target.value})}
                      placeholder="e.g. JCB 3DX Backhoe Loader"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newMachine.category}
                      onChange={e => setNewMachine({...newMachine, category: e.target.value})}
                    >
                      <option>Excavator</option>
                      <option>Loader</option>
                      <option>Crane</option>
                      <option>Bulldozer</option>
                      <option>Roller</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Price (₹/hr)</label>
                    <input 
                      type="number" required
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newMachine.price_per_hour}
                      onChange={e => setNewMachine({...newMachine, price_per_hour: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
                    <input 
                      type="text" required
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newMachine.location}
                      onChange={e => setNewMachine({...newMachine, location: e.target.value})}
                      placeholder="City, State"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Image URL (Optional)</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newMachine.image_url}
                      onChange={e => setNewMachine({...newMachine, image_url: e.target.value})}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors mt-4 shadow-lg shadow-emerald-600/20">
                  List Machine
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RenterDashboard: React.FC<{ user: User, onNavigate: (view: string) => void }> = ({ user, onNavigate }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState({ category: '', location: '' });
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [bookingDates, setBookingDates] = useState({ start: '', end: '' });
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'dashboard' | 'payments'>('search');

  const fetchData = async () => {
    const query = new URLSearchParams(search).toString();
    const [mRes, bRes] = await Promise.all([
      fetch(`/api/machines?${query}`),
      apiFetch(`/api/bookings/renter/${user.id}`)
    ]);
    setMachines(await mRes.json());
    setBookings(await bRes.json());
  };

  useEffect(() => { fetchData(); }, [search]);

  const handleBook = async () => {
    if (!selectedMachine) return;
    const start = new Date(bookingDates.start);
    const end = new Date(bookingDates.end);
    if (!bookingDates.start || !bookingDates.end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setCancelMessage({ text: 'Please choose a valid booking range.', type: 'error' });
      setTimeout(() => setCancelMessage(null), 5000);
      return;
    }

    const res = await apiFetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: selectedMachine.id,
        renter_id: user.id,
        start_date: bookingDates.start,
        end_date: bookingDates.end
      })
    });
    if (!res.ok) {
      const data = await res.json();
      setCancelMessage({ text: data.detail || 'Booking failed.', type: 'error' });
      setTimeout(() => setCancelMessage(null), 5000);
      return;
    }
    setSelectedMachine(null);
    setBookingDates({ start: '', end: '' });
    fetchData();
    setActiveTab('dashboard');
  };

  const handlePayment = async (booking: Booking, type: 'INITIAL' | 'FINAL') => {
    const amount = type === 'INITIAL'
      ? getInitialPaymentAmount(booking.total_cost)
      : getFinalPaymentAmount(booking.total_cost, booking.extra_cost);
    const res = await apiFetch(`/api/bookings/${booking.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount })
    });
    if (res.ok) {
      setPaymentSuccess(`Payment of Rs ${amount} successful. Confirmation sent to owner.`);
      setTimeout(() => setPaymentSuccess(null), 5000);
      fetchData();
    } else {
      const data = await res.json();
      setCancelMessage({ text: data.detail || 'Payment failed.', type: 'error' });
      setTimeout(() => setCancelMessage(null), 5000);
    }
  };

  const completeBooking = async (id: string) => {
    const actual_end_date = new Date().toISOString().slice(0, 16);
    await apiFetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED', actual_end_date })
    });
    fetchData();
  };

  const cancelBooking = async (b: Booking) => {
    // Client-side 8-hour check first
    const startTime = new Date(b.start_date).getTime();
    const hoursUntilStart = (startTime - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilStart < 8) {
      setCancelMessage({
        text: `Cancellation not allowed. Your booking starts in ${Math.max(0, hoursUntilStart).toFixed(1)} hours. Cancellations must be made at least 8 hours before the start time.`,
        type: 'error'
      });
      setTimeout(() => setCancelMessage(null), 6000);
      return;
    }
    const res = await apiFetch(`/api/bookings/${b.id}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setCancelMessage({ text: 'Booking cancelled successfully.', type: 'success' });
      setTimeout(() => setCancelMessage(null), 4000);
      fetchData();
    } else {
      setCancelMessage({ text: data.detail || 'Cancellation failed.', type: 'error' });
      setTimeout(() => setCancelMessage(null), 6000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Cancel notification toast */}
      {cancelMessage && (
        <div className={`fixed top-20 right-6 z-[100] max-w-sm p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-fadeIn ${
          cancelMessage.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex-shrink-0 mt-0.5">
            {cancelMessage.type === 'error'
              ? <XCircle className="w-5 h-5 text-red-500" />
              : <CheckCircle className="w-5 h-5 text-emerald-500" />}
          </div>
          <p className="text-sm font-medium leading-snug">{cancelMessage.text}</p>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Renter Portal</h1>
          <p className="text-zinc-500">Manage your equipment rentals and payments</p>
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button 
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'search' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Search className="w-4 h-4" />
            Browse
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'dashboard' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'payments' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <CreditCard className="w-4 h-4" />
            Payments
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'search' && (
          <motion.div 
            key="search"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-8"
          >
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  <Search className="w-4 h-4" /> Filters
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Category</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      value={search.category}
                      onChange={e => setSearch({...search, category: e.target.value})}
                    >
                      <option value="">All Categories</option>
                      <option>Excavator</option>
                      <option>Loader</option>
                      <option>Crane</option>
                      <option>Bulldozer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text"
                        placeholder="Search city..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        value={search.location}
                        onChange={e => setSearch({...search, location: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {machines.map(m => (
                  <MachineCard key={m.id} machine={m} onBook={setSelectedMachine} />
                ))}
                {machines.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <Search className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-zinc-900">No machines found</h3>
                    <p className="text-zinc-500">Try adjusting your filters or location</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map(b => (
                <div key={b.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">{b.machine_name}</h3>
                      <p className="text-sm text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {b.start_date}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-black ${
                      b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 
                      b.status === 'COMPLETED' ? 'bg-zinc-100 text-zinc-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Total Cost</span>
                      <span className="font-bold text-zinc-900">₹{b.total_cost}</span>
                    </div>
                    {b.extra_cost > 0 && (
                      <div className="flex justify-between text-sm text-amber-600">
                        <span>Extra Charges</span>
                        <span className="font-bold">₹{b.extra_cost}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    { (b.status === 'CONFIRMED' || b.status === 'PENDING') && b.initial_paid === 0 && (
                      <button 
                        onClick={() => handlePayment(b, 'INITIAL')}
                        className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Pay Initial 50% (₹{getInitialPaymentAmount(b.total_cost)})
                      </button>
                    )}

                    {b.status === 'CONFIRMED' && b.initial_paid === 1 && (
                      <button 
                        onClick={() => completeBooking(b.id)}
                        className="w-full bg-zinc-900 text-white py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors"
                      >
                        Mark Work Completed
                      </button>
                    )}

                    {b.status === 'COMPLETED' && b.final_paid === 0 && (
                      <button 
                        onClick={() => handlePayment(b, 'FINAL')}
                        className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Pay Final Balance (₹{getFinalPaymentAmount(b.total_cost, b.extra_cost)})
                      </button>
                    )}

                    {b.final_paid === 1 && (
                      <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm py-2">
                        <CheckCircle className="w-4 h-4" />
                        Fully Paid
                      </div>
                    )}

                    {/* Cancel Button – only for active bookings */}
                    {(b.status === 'PENDING' || b.status === 'CONFIRMED') && b.initial_paid === 0 && (() => {
                      const hoursLeft = (new Date(b.start_date).getTime() - Date.now()) / (1000 * 60 * 60);
                      return hoursLeft >= 8 ? (
                        <button
                          onClick={() => cancelBooking(b)}
                          className="w-full mt-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                        >
                          Cancel Booking
                        </button>
                      ) : hoursLeft > 0 ? (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-1">
                          <XCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Cancellation closed – starts in {hoursLeft.toFixed(1)} hrs</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-zinc-200 border-dashed">
                  <History className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-zinc-900">No bookings yet</h3>
                  <p className="text-zinc-500">Your rental history will appear here</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <motion.div 
            key="payments"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Machine / Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Value</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Initial (50%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Final Balance</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900">{b.machine_name}</div>
                      <div className="text-xs text-zinc-500">{b.start_date}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">₹{b.total_cost + b.extra_cost}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {b.initial_paid ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">PAID</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-zinc-100 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-bold">PENDING</span>
                            {(b.status === 'CONFIRMED' || b.status === 'PENDING') && (
                              <button 
                                onClick={() => handlePayment(b, 'INITIAL')}
                                className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded font-bold hover:bg-emerald-700"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-sm text-zinc-600 font-medium">₹{getInitialPaymentAmount(b.total_cost)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {b.final_paid ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">PAID</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="bg-zinc-100 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-bold">PENDING</span>
                            {b.status === 'COMPLETED' && (
                              <button 
                                onClick={() => handlePayment(b, 'FINAL')}
                                className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded font-bold hover:bg-emerald-700"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-sm text-zinc-600 font-medium">₹{getFinalPaymentAmount(b.total_cost, b.extra_cost)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {b.final_paid && b.initial_paid ? (
                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                          <CheckCircle className="w-4 h-4" /> Cleared
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                          <Clock className="w-4 h-4" /> Incomplete
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">
                      No payment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 bg-emerald-600 text-white p-4 rounded-2xl font-bold shadow-2xl z-[100] flex items-center gap-3"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <CheckCircle className="w-5 h-5" />
            </div>
            {paymentSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMachine && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-zinc-900">Book Machine</h2>
                <button onClick={() => setSelectedMachine(null)} className="text-zinc-400 hover:text-zinc-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-sm text-zinc-500 mb-1">You are booking</p>
                <h3 className="text-xl font-bold text-zinc-900">{selectedMachine.name}</h3>
                <p className="text-emerald-600 font-bold">₹{selectedMachine.price_per_hour}/hr</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date & Time</label>
                  <input 
                    type="datetime-local" required
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={bookingDates.start}
                    onChange={e => setBookingDates({...bookingDates, start: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">End Date & Time</label>
                  <input 
                    type="datetime-local" required
                    className="w-full px-4 py-2 rounded-lg border border-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={bookingDates.end}
                    onChange={e => setBookingDates({...bookingDates, end: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleBook}
                  disabled={!bookingDates.start || !bookingDates.end}
                  className="w-full bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Booking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Dashboard shown to the admin user.
const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [pendingOwners, setPendingOwners] = useState<User[]>([]);

  const fetchPending = async () => {
    const res = await apiFetch('/api/admin/pending-owners');
    setPendingOwners(await res.json());
  };

  useEffect(() => { fetchPending(); }, []);

  const approveOwner = async (id: string) => {
    await apiFetch(`/api/admin/approve-owner/${id}`, { method: 'PATCH' });
    fetchPending();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">Admin Control Panel</h1>
        <p className="text-zinc-500">Review and approve machinery owners</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Owner Details</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Credentials</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {pendingOwners.map(owner => (
                <tr key={owner.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900">{owner.name}</div>
                    <div className="text-sm text-zinc-500">{owner.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <span className="font-semibold text-zinc-700">ID Proof:</span> {owner.id_proof}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-zinc-700">Shop:</span> {owner.shop_credentials}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => approveOwner(owner.id)}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      Approve Owner
                    </button>
                  </td>
                </tr>
              ))}
              {pendingOwners.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 italic">
                    No pending owner approvals at the moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Waiting screen shown to owners before an admin approves them.
const PendingApproval: React.FC = () => (
  <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-zinc-50 p-4">
    <div className="bg-white p-12 rounded-3xl shadow-xl border border-zinc-200 max-w-lg text-center">
      <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Clock className="w-10 h-10 text-amber-600" />
      </div>
      <h2 className="text-3xl font-black text-zinc-900 mb-4 tracking-tight">Approval Pending</h2>
      <p className="text-zinc-600 text-lg leading-relaxed mb-8">
        Your account is currently being reviewed by our administration team. 
        We are verifying your ID and shop credentials to ensure a safe marketplace.
      </p>
      <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm text-zinc-500">
        Typically takes 24-48 hours. You will be able to list machines once approved.
      </div>
    </div>
  </div>
);

// Public landing page.
const HomePage: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => (
  <div className="relative overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 pt-20 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl mx-auto"
      >
        <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
          The #1 Heavy Equipment Marketplace
        </span>
        <h1 className="text-6xl font-black text-zinc-900 mb-6 tracking-tight leading-[1.1]">
          Rent heavy machinery <span className="text-emerald-600">anywhere, anytime.</span>
        </h1>
        <p className="text-xl text-zinc-600 mb-10 leading-relaxed">
          Connect with local machine owners. From excavators to cranes, get the equipment you need for your construction projects with transparent pricing.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => onNavigate('auth')}
            className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
          >
            Get Started
          </button>
          <button 
            onClick={() => onNavigate('renter')}
            className="bg-white text-zinc-900 border border-zinc-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-50 transition-all"
          >
            Browse Machines
          </button>
        </div>
      </motion.div>
    </div>

    <div className="max-w-7xl mx-auto px-4 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <Search className="w-6 h-6" />, title: "Easy Discovery", desc: "Search by category and location to find the perfect match for your site." },
          { icon: <Clock className="w-6 h-6" />, title: "Fast Booking", desc: "Select your dates and book instantly. No more endless phone calls." },
          { icon: <CheckCircle className="w-6 h-6" />, title: "Verified Owners", desc: "Rent with confidence from our community of trusted machinery owners." }
        ].map((feature, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="bg-white p-8 rounded-2xl border border-zinc-100 shadow-sm"
          >
            <div className="bg-emerald-50 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">{feature.title}</h3>
            <p className="text-zinc-500">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default function App() {
  // Top-level app state:
  // `user` stores the current logged-in user.
  // `view` decides which major screen should be displayed.
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('home');

  useEffect(() => {
    // Restore the last logged-in user from browser storage on page refresh.
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setView('dashboard');
    } else {
      clearStoredSession();
    }
  }, []);

  const handleLogin = (session: AuthSession) => {
    // Save the user both in React state and in browser storage.
    setUser(session.user);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    setView('dashboard');
  };

  const handleLogout = () => {
    // Clear the local session when the user logs out.
    setUser(null);
    clearStoredSession();
    setView('home');
  };

  const renderView = () => {
    // This behaves like a very small client-side router.
    if (view === 'auth') return <AuthPage onLogin={handleLogin} />;
    if (view === 'home') {
      if (user?.role === 'RENTER') return <RenterDashboard user={user} onNavigate={setView} />;
      return <HomePage onNavigate={setView} />;
    }
    
    if (!user) return <AuthPage onLogin={handleLogin} />;

    if (user.role === 'ADMIN') return <AdminDashboard user={user} />;

    if (user.role === 'OWNER' && user.is_approved === 0) return <PendingApproval />;

    if (view === 'dashboard') {
      return user.role === 'OWNER' ? <OwnerDashboard user={user} /> : <RenterDashboard user={user} onNavigate={setView} />;
    }
    if (view === 'renter') return <RenterDashboard user={user} onNavigate={setView} />;
    
    return <HomePage onNavigate={setView} />;
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar user={user} onLogout={handleLogout} onNavigate={setView} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
      
      <footer className="bg-white border-t border-zinc-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Truck className="text-emerald-600 w-6 h-6" />
            <span className="text-xl font-bold tracking-tight text-zinc-900">Conren</span>
          </div>
          <p className="text-zinc-500 text-sm">© 2026 Conren Marketplace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
