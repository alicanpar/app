#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Fitness Tracker Application
Tests all backend endpoints including authentication, exercises, workouts, progress, AI coach, and dashboard.
"""

import requests
import json
import uuid
from datetime import datetime, timezone
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://exercise-helper-6.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

class FitnessAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session_token = None
        self.user_data = None
        self.test_results = {
            'authentication': {'passed': 0, 'failed': 0, 'errors': []},
            'exercises': {'passed': 0, 'failed': 0, 'errors': []},
            'workouts': {'passed': 0, 'failed': 0, 'errors': []},
            'progress': {'passed': 0, 'failed': 0, 'errors': []},
            'ai_coach': {'passed': 0, 'failed': 0, 'errors': []},
            'dashboard': {'passed': 0, 'failed': 0, 'errors': []},
            'profile': {'passed': 0, 'failed': 0, 'errors': []}
        }
        
    def log_result(self, category, test_name, success, error_msg=None):
        """Log test result"""
        if success:
            self.test_results[category]['passed'] += 1
            print(f"✅ {test_name}")
        else:
            self.test_results[category]['failed'] += 1
            self.test_results[category]['errors'].append(f"{test_name}: {error_msg}")
            print(f"❌ {test_name}: {error_msg}")
    
    def test_basic_connectivity(self):
        """Test basic API connectivity"""
        print("\n🔍 Testing Basic API Connectivity...")
        try:
            response = self.session.get(f"{API_BASE}/")
            if response.status_code == 200:
                print("✅ API is accessible")
                return True
            else:
                print(f"❌ API connectivity failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ API connectivity failed: {str(e)}")
            return False
    
    def test_authentication_system(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication System...")
        
        # Test session data endpoint without session ID
        try:
            response = self.session.get(f"{API_BASE}/auth/session-data")
            if response.status_code == 400:
                self.log_result('authentication', 'Session data validation (no session ID)', True)
            else:
                self.log_result('authentication', 'Session data validation (no session ID)', False, 
                              f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Session data validation (no session ID)', False, str(e))
        
        # Test with invalid session ID
        try:
            response = self.session.get(f"{API_BASE}/auth/session-data", 
                                      headers={"X-Session-ID": "invalid-session-id"})
            if response.status_code in [400, 401]:
                self.log_result('authentication', 'Invalid session ID handling', True)
            else:
                self.log_result('authentication', 'Invalid session ID handling', False, 
                              f"Expected 400/401, got {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Invalid session ID handling', False, str(e))
        
        # Test logout endpoint without authentication
        try:
            response = self.session.post(f"{API_BASE}/auth/logout")
            if response.status_code == 401:
                self.log_result('authentication', 'Logout without auth', True)
            else:
                self.log_result('authentication', 'Logout without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('authentication', 'Logout without auth', False, str(e))
    
    def test_exercise_database_api(self):
        """Test exercise database endpoints"""
        print("\n💪 Testing Exercise Database API...")
        
        # Test get all exercises
        try:
            response = self.session.get(f"{API_BASE}/exercises")
            if response.status_code == 200:
                exercises = response.json()
                if isinstance(exercises, list) and len(exercises) > 0:
                    self.log_result('exercises', 'Get all exercises', True)
                    
                    # Verify exercise structure
                    exercise = exercises[0]
                    required_fields = ['id', 'name', 'category', 'muscle_groups', 'instructions', 'difficulty']
                    if all(field in exercise for field in required_fields):
                        self.log_result('exercises', 'Exercise data structure', True)
                    else:
                        self.log_result('exercises', 'Exercise data structure', False, 
                                      f"Missing required fields in exercise data")
                else:
                    self.log_result('exercises', 'Get all exercises', False, "No exercises returned")
            else:
                self.log_result('exercises', 'Get all exercises', False, 
                              f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result('exercises', 'Get all exercises', False, str(e))
        
        # Test filter by category
        try:
            response = self.session.get(f"{API_BASE}/exercises?category=strength")
            if response.status_code == 200:
                exercises = response.json()
                if isinstance(exercises, list):
                    # Check if all returned exercises are strength category
                    if all(ex.get('category') == 'strength' for ex in exercises):
                        self.log_result('exercises', 'Filter by category', True)
                    else:
                        self.log_result('exercises', 'Filter by category', False, 
                                      "Some exercises don't match category filter")
                else:
                    self.log_result('exercises', 'Filter by category', False, "Invalid response format")
            else:
                self.log_result('exercises', 'Filter by category', False, 
                              f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result('exercises', 'Filter by category', False, str(e))
        
        # Test filter by difficulty
        try:
            response = self.session.get(f"{API_BASE}/exercises?difficulty=beginner")
            if response.status_code == 200:
                exercises = response.json()
                if isinstance(exercises, list):
                    if all(ex.get('difficulty') == 'beginner' for ex in exercises):
                        self.log_result('exercises', 'Filter by difficulty', True)
                    else:
                        self.log_result('exercises', 'Filter by difficulty', False, 
                                      "Some exercises don't match difficulty filter")
                else:
                    self.log_result('exercises', 'Filter by difficulty', False, "Invalid response format")
            else:
                self.log_result('exercises', 'Filter by difficulty', False, 
                              f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result('exercises', 'Filter by difficulty', False, str(e))
    
    def test_workout_management_api(self):
        """Test workout management endpoints"""
        print("\n🏋️ Testing Workout Management API...")
        
        # Test create workout without authentication
        try:
            workout_data = {
                "name": "Test Workout",
                "exercises": [
                    {
                        "exercise_id": str(uuid.uuid4()),
                        "sets": 3,
                        "reps": 10,
                        "weight": 50.0
                    }
                ],
                "notes": "Test workout notes"
            }
            response = self.session.post(f"{API_BASE}/workouts", json=workout_data)
            if response.status_code == 401:
                self.log_result('workouts', 'Create workout without auth', True)
            else:
                self.log_result('workouts', 'Create workout without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('workouts', 'Create workout without auth', False, str(e))
        
        # Test get workouts without authentication
        try:
            response = self.session.get(f"{API_BASE}/workouts")
            if response.status_code == 401:
                self.log_result('workouts', 'Get workouts without auth', True)
            else:
                self.log_result('workouts', 'Get workouts without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('workouts', 'Get workouts without auth', False, str(e))
        
        # Test get specific workout without authentication
        try:
            response = self.session.get(f"{API_BASE}/workouts/{str(uuid.uuid4())}")
            if response.status_code == 401:
                self.log_result('workouts', 'Get specific workout without auth', True)
            else:
                self.log_result('workouts', 'Get specific workout without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('workouts', 'Get specific workout without auth', False, str(e))
    
    def test_progress_tracking_api(self):
        """Test progress tracking endpoints"""
        print("\n📈 Testing Progress Tracking API...")
        
        # Test add progress without authentication
        try:
            progress_data = {
                "weight": 75.5,
                "body_fat": 15.2,
                "measurements": {
                    "chest": 100,
                    "waist": 85,
                    "bicep": 35
                },
                "notes": "Feeling stronger today"
            }
            response = self.session.post(f"{API_BASE}/progress", json=progress_data)
            if response.status_code == 401:
                self.log_result('progress', 'Add progress without auth', True)
            else:
                self.log_result('progress', 'Add progress without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('progress', 'Add progress without auth', False, str(e))
        
        # Test get progress without authentication
        try:
            response = self.session.get(f"{API_BASE}/progress")
            if response.status_code == 401:
                self.log_result('progress', 'Get progress without auth', True)
            else:
                self.log_result('progress', 'Get progress without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('progress', 'Get progress without auth', False, str(e))
        
        # Test get progress with days parameter
        try:
            response = self.session.get(f"{API_BASE}/progress?days=30")
            if response.status_code == 401:
                self.log_result('progress', 'Get progress with days filter without auth', True)
            else:
                self.log_result('progress', 'Get progress with days filter without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('progress', 'Get progress with days filter without auth', False, str(e))
    
    def test_ai_coach_integration(self):
        """Test AI coach endpoints"""
        print("\n🤖 Testing AI Coach Integration...")
        
        # Test AI coach without authentication
        try:
            question_data = {
                "question": "What's a good workout routine for beginners?",
                "context": {"goal": "muscle_building"}
            }
            response = self.session.post(f"{API_BASE}/ai/ask", json=question_data)
            if response.status_code == 401:
                self.log_result('ai_coach', 'AI coach without auth', True)
            else:
                self.log_result('ai_coach', 'AI coach without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('ai_coach', 'AI coach without auth', False, str(e))
        
        # Test AI coach with empty question
        try:
            question_data = {
                "question": "",
                "context": {}
            }
            response = self.session.post(f"{API_BASE}/ai/ask", json=question_data)
            if response.status_code in [400, 401, 422]:
                self.log_result('ai_coach', 'AI coach with empty question', True)
            else:
                self.log_result('ai_coach', 'AI coach with empty question', False, 
                              f"Expected 400/401/422, got {response.status_code}")
        except Exception as e:
            self.log_result('ai_coach', 'AI coach with empty question', False, str(e))
    
    def test_dashboard_stats_api(self):
        """Test dashboard statistics endpoints"""
        print("\n📊 Testing Dashboard Stats API...")
        
        # Test dashboard stats without authentication
        try:
            response = self.session.get(f"{API_BASE}/dashboard/stats")
            if response.status_code == 401:
                self.log_result('dashboard', 'Dashboard stats without auth', True)
            else:
                self.log_result('dashboard', 'Dashboard stats without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('dashboard', 'Dashboard stats without auth', False, str(e))
    
    def test_user_profile_management(self):
        """Test user profile management endpoints"""
        print("\n👤 Testing User Profile Management...")
        
        # Test get profile without authentication
        try:
            response = self.session.get(f"{API_BASE}/profile")
            if response.status_code == 401:
                self.log_result('profile', 'Get profile without auth', True)
            else:
                self.log_result('profile', 'Get profile without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('profile', 'Get profile without auth', False, str(e))
        
        # Test update profile without authentication
        try:
            profile_data = {
                "fitness_goals": ["weight_loss", "muscle_building"],
                "experience_level": "intermediate"
            }
            response = self.session.put(f"{API_BASE}/profile", json=profile_data)
            if response.status_code == 401:
                self.log_result('profile', 'Update profile without auth', True)
            else:
                self.log_result('profile', 'Update profile without auth', False, 
                              f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_result('profile', 'Update profile without auth', False, str(e))
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 TEST SUMMARY")
        print("="*60)
        
        total_passed = sum(category['passed'] for category in self.test_results.values())
        total_failed = sum(category['failed'] for category in self.test_results.values())
        total_tests = total_passed + total_failed
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {total_passed} ✅")
        print(f"Failed: {total_failed} ❌")
        print(f"Success Rate: {(total_passed/total_tests*100):.1f}%" if total_tests > 0 else "No tests run")
        
        print("\nDetailed Results by Category:")
        for category, results in self.test_results.items():
            total_cat = results['passed'] + results['failed']
            if total_cat > 0:
                success_rate = (results['passed'] / total_cat) * 100
                print(f"\n{category.upper()}:")
                print(f"  Passed: {results['passed']}, Failed: {results['failed']} ({success_rate:.1f}%)")
                
                if results['errors']:
                    print("  Errors:")
                    for error in results['errors']:
                        print(f"    - {error}")
        
        return {
            'total_tests': total_tests,
            'total_passed': total_passed,
            'total_failed': total_failed,
            'success_rate': (total_passed/total_tests*100) if total_tests > 0 else 0,
            'category_results': self.test_results
        }
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Comprehensive Backend API Testing...")
        print(f"Testing API at: {API_BASE}")
        
        # Test basic connectivity first
        if not self.test_basic_connectivity():
            print("❌ Cannot proceed with tests - API is not accessible")
            return self.print_summary()
        
        # Run all test suites
        self.test_authentication_system()
        self.test_exercise_database_api()
        self.test_workout_management_api()
        self.test_progress_tracking_api()
        self.test_ai_coach_integration()
        self.test_dashboard_stats_api()
        self.test_user_profile_management()
        
        return self.print_summary()

def main():
    """Main test execution"""
    tester = FitnessAPITester()
    results = tester.run_all_tests()
    
    # Return results for programmatic access
    return results

if __name__ == "__main__":
    main()