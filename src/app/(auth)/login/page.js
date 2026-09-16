'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api, { setupAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: 'admin@crm.com', password: 'Admin@123' });
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const checkConnection = async () => {
    try {
      const [health, setup] = await Promise.all([
        api.get('/health'),
        setupAPI.getStatus(),
      ]);
      setApiStatus({
        ok: true,
        port: health.data.port,
        database: setup.data.database,
        userCount: setup.data.userCount,
        adminExists: setup.data.adminExists,
        hint: setup.data.hint,
      });
    } catch (err) {
      setApiStatus({
        ok: false,
        message: err.response?.data?.message || err.message || 'Cannot reach backend',
      });
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      const res = await setupAPI.bootstrap();
      toast.success(res.data.message);
      await checkConnection();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally {
      setBootstrapping(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err) {
      if (!err.response) {
        toast.error('Cannot reach API. Start backend: cd backend && npm run dev');
        await checkConnection();
      } else {
        toast.error(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const needsSetup = apiStatus?.ok && apiStatus.userCount === 0;

  return (
    <>
      <h2 className="text-2xl font-bold text-surface-900 mb-1">Welcome back</h2>
      <p className="text-surface-500 text-sm mb-4">Sign in to manage projects and tasks</p>

      {/* {apiStatus && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs border ${
            apiStatus.ok
              ? needsSetup
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {apiStatus.ok ? (
            <>
              <p className="font-semibold">API connected (port {apiStatus.port})</p>
              <p>Database: {apiStatus.database} · Users: {apiStatus.userCount}</p>
              {needsSetup ? (
                <>
                  <p className="mt-1 font-medium">No users in database yet — create demo accounts first.</p>
                  <button
                    type="button"
                    onClick={handleBootstrap}
                    disabled={bootstrapping}
                    className="mt-3 w-full btn-primary text-sm py-2"
                  >
                    {bootstrapping ? 'Creating users…' : 'Create demo users (admin, manager, dev, client)'}
                  </button>
                </>
              ) : (
                <p>{apiStatus.adminExists ? '✓ Admin ready — sign in below' : '✗ No admin — run npm run ensure-users'}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">API not reachable</p>
              <p>{apiStatus.message}</p>
              <p className="mt-1">Start backend: <code>cd backend && npm run dev</code></p>
            </>
          )}
          <button type="button" onClick={checkConnection} className="mt-2 underline font-medium">
            Recheck connection
          </button>
        </div>
      )} */}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input
            type="email"
            className="input"
            placeholder="admin@crm.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pr-12"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-surface-500 hover:text-surface-800"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.584 10.587a2 2 0 002.829 2.829M9.88 4.24A10.94 10.94 0 0112 4c5 0 8.5 4 9.5 8a11.6 11.6 0 01-3.033 5.088M6.228 6.228C4.39 7.55 3.166 9.39 2.5 12c1 4 4.5 8 9.5 8a10.94 10.94 0 004.12-.8" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.5 12S6 4 12 4s9.5 8 9.5 8S18 20 12 20 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                </svg>
              )}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading || needsSetup} className="btn-primary w-full disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {/* <p className="mt-4 text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary-600 hover:underline font-medium">
          Register
        </Link>
      </p> */}
    </>
  );
}
