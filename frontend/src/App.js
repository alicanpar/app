import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Activity, Target, BarChart3, MessageCircle, User, Plus, LogOut, Dumbbell, TrendingUp } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import '@/App.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null);

  const login = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/auth/session-data?x_session_id=${sessionId}`);
      const { user: userData, session_token } = response.data;
      
      setUser(userData);
      setSessionToken(session_token);
      
      // Set cookie
      document.cookie = `session_token=${session_token}; path=/; secure; samesite=none; max-age=${7 * 24 * 60 * 60}`;
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSessionToken(null);
      document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  };

  const checkSession = async () => {
    try {
      const response = await axios.get(`${API}/profile`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      // Session invalid or expired
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for session_id in URL fragment
    const hash = window.location.hash;
    if (hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1].split('&')[0];
      login(sessionId).then(() => {
        // Clean URL
        window.location.hash = '';
        window.history.replaceState(null, null, window.location.pathname);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      checkSession();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionToken }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Loading Component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Yükleniyor...</p>
    </div>
  </div>
);

// Login Component
const Login = () => {
  const handleGoogleLogin = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-indigo-100 p-3 rounded-full">
                <Dumbbell className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Fitness Tracker</h2>
            <p className="text-gray-600 mb-8">Fitness yolculuğunuza başlayın ve hedeflerinize ulaşın!</p>
            
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google ile Giriş Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = ({ currentPage, setCurrentPage }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'workouts', label: 'Antrenmanlar', icon: Activity },
    { id: 'progress', label: 'İlerleme', icon: TrendingUp },
    { id: 'exercises', label: 'Egzersizler', icon: Dumbbell },
    { id: 'ai-coach', label: 'AI Koç', icon: MessageCircle },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="bg-white border-r border-gray-200 w-64 min-h-screen">
      <div className="p-6">
        <div className="flex items-center mb-8">
          <div className="bg-indigo-100 p-2 rounded-lg mr-3">
            <Dumbbell className="h-6 w-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Fitness Tracker</h1>
        </div>
        
        <div className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                  currentPage === item.id
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </div>
        
        <div className="mt-auto pt-8">
          <div className="flex items-center mb-4">
            <img
              src={user?.picture || 'https://via.placeholder.com/32'}
              alt="Profile"
              className="h-8 w-8 rounded-full mr-3"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors duration-150"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Çıkış Yap
          </button>
        </div>
      </div>
    </nav>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API}/dashboard/stats`, { withCredentials: true });
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Toplam Antrenman</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_workouts || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bu Hafta</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.workouts_this_week || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Son Ağırlık</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.latest_progress?.weight ? `${stats.latest_progress.weight}kg` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Workouts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Son Antrenmanlar</h3>
        {stats?.recent_workouts?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_workouts.map((workout) => (
              <div key={workout.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{workout.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(workout.date).toLocaleDateString('tr-TR')} • {workout.exercises?.length || 0} egzersiz
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{workout.duration || 0} dakika</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Henüz antrenman kaydı yok. İlk antrenmanınızı eklemeye başlayın!</p>
        )}
      </div>
    </div>
  );
};

// Workouts Component
const Workouts = () => {
  const [workouts, setWorkouts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
    fetchExercises();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await axios.get(`${API}/workouts`, { withCredentials: true });
      setWorkouts(response.data);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      const response = await axios.get(`${API}/exercises`);
      setExercises(response.data);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Antrenmanlar</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          <Plus className="h-5 w-5 mr-2" />
          Yeni Antrenman
        </button>
      </div>
      
      {workouts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workouts.map((workout) => (
            <div key={workout.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">{workout.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {new Date(workout.date).toLocaleDateString('tr-TR')}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {workout.exercises?.length || 0} egzersiz • {workout.duration || 0} dakika
              </p>
              {workout.notes && (
                <p className="text-sm text-gray-500">{workout.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Henüz antrenman kaydınız yok</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            İlk Antrenmanınızı Ekleyin
          </button>
        </div>
      )}

      {/* Add Workout Modal */}
      {showAddModal && (
        <AddWorkoutModal
          exercises={exercises}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchWorkouts();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

// Add Workout Modal Component
const AddWorkoutModal = ({ exercises, onClose, onSuccess }) => {
  const [workoutName, setWorkoutName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [notes, setNotes] = useState('');

  const addExercise = (exercise) => {
    setSelectedExercises([...selectedExercises, {
      exercise_id: exercise.id,
      sets: 3,
      reps: 10,
      weight: 0,
      duration: 0,
      rest_time: 60,
      notes: ''
    }]);
  };

  const updateExercise = (index, field, value) => {
    const updated = [...selectedExercises];
    updated[index][field] = value;
    setSelectedExercises(updated);
  };

  const removeExercise = (index) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/workouts`, {
        name: workoutName,
        exercises: selectedExercises,
        notes: notes
      }, { withCredentials: true });
      onSuccess();
    } catch (error) {
      console.error('Error creating workout:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Yeni Antrenman Ekle</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Antrenman Adı
            </label>
            <input
              type="text"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Egzersizler Ekle
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {exercises.slice(0, 6).map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => addExercise(exercise)}
                  className="p-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {exercise.name}
                </button>
              ))}
            </div>
          </div>
          
          {selectedExercises.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Seçilen Egzersizler</h4>
              <div className="space-y-3">
                {selectedExercises.map((ex, index) => {
                  const exercise = exercises.find(e => e.id === ex.exercise_id);
                  return (
                    <div key={index} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-gray-900">{exercise?.name}</p>
                        <button
                          type="button"
                          onClick={() => removeExercise(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Set"
                          value={ex.sets}
                          onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value) || 0)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <input
                          type="number"
                          placeholder="Tekrar"
                          value={ex.reps}
                          onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value) || 0)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Ağırlık"
                          value={ex.weight}
                          onChange={(e) => updateExercise(index, 'weight', parseFloat(e.target.value) || 0)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notlar
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!workoutName || selectedExercises.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Antrenman Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Progress Component
const Progress = () => {
  const [progressData, setProgressData] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await axios.get(`${API}/progress`, { withCredentials: true });
      setProgressData(response.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: progressData.slice(-10).map(p => new Date(p.date).toLocaleDateString('tr-TR')),
    datasets: [
      {
        label: 'Ağırlık (kg)',
        data: progressData.slice(-10).map(p => p.weight || 0),
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Ağırlık İlerlemesi',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  if (loading) return <Loading />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">İlerleme Takibi</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          <Plus className="h-5 w-5 mr-2" />
          İlerleme Ekle
        </button>
      </div>
      
      {progressData.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">İlerleme Geçmişi</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {progressData.slice(0, 10).map((progress) => (
                <div key={progress.id} className="p-6 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(progress.date).toLocaleDateString('tr-TR')}
                    </p>
                    {progress.notes && (
                      <p className="text-sm text-gray-500">{progress.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {progress.weight && (
                      <p className="text-lg font-semibold text-gray-900">{progress.weight}kg</p>
                    )}
                    {progress.body_fat && (
                      <p className="text-sm text-gray-500">Yağ: %{progress.body_fat}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Henüz ilerleme kaydınız yok</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            İlk Ölçümünüzü Ekleyin
          </button>
        </div>
      )}

      {/* Add Progress Modal */}
      {showAddModal && (
        <AddProgressModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchProgress();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

// Add Progress Modal Component
const AddProgressModal = ({ onClose, onSuccess }) => {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/progress`, {
        weight: weight ? parseFloat(weight) : null,
        body_fat: bodyFat ? parseFloat(bodyFat) : null,
        measurements: {},
        notes: notes
      }, { withCredentials: true });
      onSuccess();
    } catch (error) {
      console.error('Error adding progress:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">İlerleme Ekle</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ağırlık (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vücut Yağ Oranı (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notlar
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Exercises Component
const Exercises = () => {
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredExercises(exercises);
    } else {
      setFilteredExercises(exercises.filter(ex => ex.category === selectedCategory));
    }
  }, [exercises, selectedCategory]);

  const fetchExercises = async () => {
    try {
      const response = await axios.get(`${API}/exercises`);
      setExercises(response.data);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'all', name: 'Tümü' },
    { id: 'strength', name: 'Güç' },
    { id: 'cardio', name: 'Kardio' },
    { id: 'flexibility', name: 'Esneklik' }
  ];

  if (loading) return <Loading />;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Egzersiz Kütüphanesi</h2>
      
      <div className="mb-6">
        <div className="flex space-x-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                selectedCategory === category.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExercises.map((exercise) => (
          <div key={exercise.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${
                exercise.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                exercise.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {exercise.difficulty === 'beginner' ? 'Başlangıç' :
                 exercise.difficulty === 'intermediate' ? 'Orta' : 'İleri'}
              </span>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-1">Kas Grupları:</p>
              <div className="flex flex-wrap gap-1">
                {exercise.muscle_groups.map((muscle, index) => (
                  <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {muscle}
                  </span>
                ))}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{exercise.instructions}</p>
            
            {exercise.equipment && (
              <p className="text-xs text-gray-500">
                <strong>Ekipman:</strong> {exercise.equipment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Coach Component
const AICoach = () => {
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentQuestion.trim()) return;

    const userMessage = { role: 'user', content: currentQuestion, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setCurrentQuestion('');

    try {
      const response = await axios.post(`${API}/ai/ask`, {
        question: currentQuestion,
        context: {}
      }, { withCredentials: true });

      const aiMessage = {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error asking AI:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Üzgünüm, şu anda bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "Bugün hangi egzersizleri yapmalıyım?",
    "Kilo vermek için ne önerirsin?",
    "Kas kazanmak için nasıl beslenmeliyim?",
    "Antrenman motivasyonum düştü, ne yapmalıyım?"
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">AI Fitness Koçu</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">AI fitness koçunuzla sohbete başlayın!</p>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-3">Örnek sorular:</p>
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestion(question)}
                    className="block w-full text-left p-3 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-indigo-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-bounce w-2 h-2 bg-gray-500 rounded-full"></div>
                    <div className="animate-bounce w-2 h-2 bg-gray-500 rounded-full" style={{ animationDelay: '0.1s' }}></div>
                    <div className="animate-bounce w-2 h-2 bg-gray-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="AI koçunuza soru sorun..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!currentQuestion.trim() || loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Gönder
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// Profile Component
const Profile = () => {
  const { user } = useAuth();
  const [fitnessGoals, setFitnessGoals] = useState(user?.fitness_goals || []);
  const [experienceLevel, setExperienceLevel] = useState(user?.experience_level || 'beginner');
  const [saving, setSaving] = useState(false);

  const goalOptions = [
    'Kilo verme',
    'Kas kazanma',
    'Dayanıklılık artırma',
    'Güç geliştirme',
    'Esneklik artırma',
    'Genel sağlık'
  ];

  const handleGoalToggle = (goal) => {
    setFitnessGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile`, {
        fitness_goals: fitnessGoals,
        experience_level: experienceLevel
      }, { withCredentials: true });
      alert('Profil başarıyla güncellendi!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Profil güncellenirken hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profil</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <img
            src={user?.picture || 'https://via.placeholder.com/64'}
            alt="Profile"
            className="h-16 w-16 rounded-full mr-4"
          />
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{user?.name}</h3>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Deneyim Seviyesi
            </label>
            <div className="flex space-x-4">
              {[
                { id: 'beginner', label: 'Başlangıç' },
                { id: 'intermediate', label: 'Orta' },
                { id: 'advanced', label: 'İleri' }
              ].map((level) => (
                <button
                  key={level.id}
                  onClick={() => setExperienceLevel(level.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    experienceLevel === level.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Fitness Hedefleri
            </label>
            <div className="grid grid-cols-2 gap-3">
              {goalOptions.map((goal) => (
                <button
                  key={goal}
                  onClick={() => handleGoalToggle(goal)}
                  className={`p-3 text-left rounded-lg border-2 transition-colors duration-200 ${
                    fitnessGoals.includes(goal)
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Kaydediliyor...' : 'Profili Güncelle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const MainApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user } = useAuth();

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'workouts': return <Workouts />;
      case 'progress': return <Progress />;
      case 'exercises': return <Exercises />;
      case 'ai-coach': return <AICoach />;
      case 'profile': return <Profile />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1">
        {renderPage()}
      </main>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Login />;
  }

  return children;
};

// App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;