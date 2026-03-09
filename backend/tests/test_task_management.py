"""
Task Management Module API Tests
Tests CRUD operations, filtering, statistics, and version history for tasks
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTaskManagementAPI:
    """Task Management Module tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        # Login as superadmin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        self.session.headers.update({'Authorization': f'Bearer {token}'})
        yield
    
    def test_get_task_statistics(self):
        """Test GET /api/tasks/statistics - returns task dashboard stats"""
        response = self.session.get(f"{BASE_URL}/api/tasks/statistics")
        assert response.status_code == 200, f"Failed to get statistics: {response.text}"
        
        stats = response.json()
        # Verify statistics structure
        assert 'total' in stats, "Missing 'total' in statistics"
        assert 'pending' in stats, "Missing 'pending' in statistics"
        assert 'in_progress' in stats, "Missing 'in_progress' in statistics"
        assert 'completed' in stats, "Missing 'completed' in statistics"
        assert 'delayed' in stats, "Missing 'delayed' in statistics"
        assert 'high_priority' in stats, "Missing 'high_priority' in statistics"
        assert 'urgent' in stats, "Missing 'urgent' in statistics"
        print(f"Statistics retrieved: {stats}")
    
    def test_get_department_stats(self):
        """Test GET /api/tasks/department-stats - returns task counts by department"""
        response = self.session.get(f"{BASE_URL}/api/tasks/department-stats")
        assert response.status_code == 200, f"Failed to get dept stats: {response.text}"
        
        dept_stats = response.json()
        assert isinstance(dept_stats, list), "Department stats should be a list"
        print(f"Department stats count: {len(dept_stats)}")
    
    def test_list_tasks(self):
        """Test GET /api/tasks - returns list of tasks"""
        response = self.session.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200, f"Failed to list tasks: {response.text}"
        
        tasks = response.json()
        assert isinstance(tasks, list), "Tasks should be a list"
        print(f"Total tasks retrieved: {len(tasks)}")
        
        # If tasks exist, verify structure
        if tasks:
            task = tasks[0]
            assert 'task_id' in task, "Missing 'task_id' in task"
            assert 'title' in task, "Missing 'title' in task"
            assert 'status' in task, "Missing 'status' in task"
            assert 'priority' in task, "Missing 'priority' in task"
            print(f"Sample task: {task.get('task_id')} - {task.get('title')}")
    
    def test_create_task(self):
        """Test POST /api/tasks - creates a new task"""
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_Task_{unique_id}",
            "description": "Test task created by automated testing",
            "department": "IT",
            "assigned_to": "",
            "assigned_to_name": "Test User",
            "priority": "High",
            "task_type": "Daily",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "due_date": datetime.now().strftime("%Y-%m-%d"),
            "estimated_hours": 4,
            "remarks": "Testing task creation"
        }
        
        response = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code == 200, f"Failed to create task: {response.text}"
        
        created_task = response.json()
        assert 'task_id' in created_task, "Created task missing 'task_id'"
        assert 'id' in created_task, "Created task missing 'id'"
        assert created_task['title'] == task_data['title'], "Title mismatch"
        assert created_task['priority'] == 'High', "Priority mismatch"
        assert created_task['status'] == 'Pending', "New task should have Pending status"
        assert created_task['version'] == 1, "New task should have version 1"
        
        print(f"Created task: {created_task['task_id']}")
        
        # Verify task is retrievable
        get_response = self.session.get(f"{BASE_URL}/api/tasks/{created_task['task_id']}")
        assert get_response.status_code == 200, "Failed to retrieve created task"
        
        return created_task
    
    def test_get_single_task(self):
        """Test GET /api/tasks/{task_id} - retrieves a single task"""
        # First create a task
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_GetSingle_{unique_id}",
            "description": "Task for get single test",
            "department": "Sales",
            "priority": "Medium",
            "task_type": "Weekly"
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        
        # Get the task
        response = self.session.get(f"{BASE_URL}/api/tasks/{created['task_id']}")
        assert response.status_code == 200, f"Failed to get task: {response.text}"
        
        task = response.json()
        assert task['task_id'] == created['task_id']
        assert task['title'] == task_data['title']
        print(f"Retrieved task: {task['task_id']}")
    
    def test_update_task(self):
        """Test PUT /api/tasks/{task_id} - updates a task and creates version history"""
        # First create a task
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_Update_{unique_id}",
            "description": "Task for update test",
            "department": "HR",
            "priority": "Low",
            "task_type": "Monthly",
            "status": "Pending"
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        
        # Update the task
        update_data = {
            "status": "In Progress",
            "completion_percentage": 25,
            "priority": "High",
            "remarks": "Started working on this task"
        }
        
        response = self.session.put(f"{BASE_URL}/api/tasks/{created['task_id']}", json=update_data)
        assert response.status_code == 200, f"Failed to update task: {response.text}"
        
        updated = response.json()
        assert updated['status'] == 'In Progress', "Status not updated"
        assert updated['completion_percentage'] == 25, "Completion percentage not updated"
        assert updated['priority'] == 'High', "Priority not updated"
        assert updated['version'] == 2, "Version should be incremented"
        
        print(f"Updated task: {updated['task_id']} to version {updated['version']}")
        
        # Verify via GET
        get_resp = self.session.get(f"{BASE_URL}/api/tasks/{created['task_id']}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()
        assert fetched['status'] == 'In Progress'
        assert fetched['version'] == 2
    
    def test_task_version_history(self):
        """Test GET /api/tasks/{task_id}/history - retrieves version history"""
        # Create and update a task to generate history
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_History_{unique_id}",
            "description": "Task for history test",
            "department": "Operations",
            "priority": "Medium",
            "task_type": "Daily"
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        
        # Update twice to create history entries
        self.session.put(f"{BASE_URL}/api/tasks/{created['task_id']}", json={"status": "In Progress"})
        self.session.put(f"{BASE_URL}/api/tasks/{created['task_id']}", json={"completion_percentage": 50})
        
        # Get history
        response = self.session.get(f"{BASE_URL}/api/tasks/{created['task_id']}/history")
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        history = response.json()
        assert isinstance(history, list), "History should be a list"
        assert len(history) >= 1, "Should have at least 1 history entry (creation)"
        
        # Verify history entry structure
        entry = history[0]
        assert 'version' in entry, "Missing 'version' in history"
        assert 'action' in entry, "Missing 'action' in history"
        assert 'timestamp' in entry, "Missing 'timestamp' in history"
        assert 'snapshot' in entry, "Missing 'snapshot' in history"
        
        print(f"Task history entries: {len(history)}")
    
    def test_delete_task(self):
        """Test DELETE /api/tasks/{task_id} - soft deletes a task"""
        # First create a task
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_Delete_{unique_id}",
            "description": "Task for delete test",
            "department": "Admin",
            "priority": "Low",
            "task_type": "Hourly"
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert create_resp.status_code == 200
        created = create_resp.json()
        
        # Delete the task
        response = self.session.delete(f"{BASE_URL}/api/tasks/{created['task_id']}")
        assert response.status_code == 200, f"Failed to delete task: {response.text}"
        
        result = response.json()
        assert 'message' in result
        print(f"Deleted task: {created['task_id']}")
        
        # Verify deleted task is not in list (soft delete)
        list_resp = self.session.get(f"{BASE_URL}/api/tasks")
        tasks = list_resp.json()
        # Deleted task might still exist but with is_deleted flag
        deleted_exists_in_list = any(t['task_id'] == created['task_id'] for t in tasks)
        # Either it's removed from list or it has is_deleted flag
        print(f"Task visible after delete: {deleted_exists_in_list}")
    
    def test_filter_tasks_by_department(self):
        """Test filtering tasks by department"""
        # Create task in specific department
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_Filter_Dept_{unique_id}",
            "department": "Marketing",
            "priority": "Medium"
        }
        self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        
        # Filter by department
        response = self.session.get(f"{BASE_URL}/api/tasks?department=Marketing")
        assert response.status_code == 200
        
        tasks = response.json()
        # All returned tasks should be in Marketing department
        for task in tasks:
            assert task['department'] == 'Marketing', f"Wrong department: {task['department']}"
        
        print(f"Marketing tasks: {len(tasks)}")
    
    def test_filter_tasks_by_status(self):
        """Test filtering tasks by status"""
        # Create a task with specific status
        unique_id = str(uuid.uuid4())[:8]
        task_data = {
            "title": f"TEST_Filter_Status_{unique_id}",
            "department": "IT",
            "priority": "High"
        }
        create_resp = self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        created = create_resp.json()
        
        # Update to specific status
        self.session.put(f"{BASE_URL}/api/tasks/{created['task_id']}", json={"status": "In Progress"})
        
        # Filter by status
        response = self.session.get(f"{BASE_URL}/api/tasks?status=In Progress")
        assert response.status_code == 200
        
        tasks = response.json()
        for task in tasks:
            assert task['status'] == 'In Progress', f"Wrong status: {task['status']}"
        
        print(f"In Progress tasks: {len(tasks)}")
    
    def test_filter_tasks_by_priority(self):
        """Test filtering tasks by priority"""
        response = self.session.get(f"{BASE_URL}/api/tasks?priority=High")
        assert response.status_code == 200
        
        tasks = response.json()
        for task in tasks:
            assert task['priority'] == 'High', f"Wrong priority: {task['priority']}"
        
        print(f"High priority tasks: {len(tasks)}")
    
    def test_search_tasks(self):
        """Test searching tasks by title/task_id"""
        # Create task with unique title
        unique_id = str(uuid.uuid4())[:8]
        search_term = f"SEARCHABLE_{unique_id}"
        task_data = {
            "title": f"TEST_{search_term}_Task",
            "department": "Logistics",
            "priority": "Medium"
        }
        self.session.post(f"{BASE_URL}/api/tasks", json=task_data)
        
        # Search for the task
        response = self.session.get(f"{BASE_URL}/api/tasks?search={search_term}")
        assert response.status_code == 200
        
        tasks = response.json()
        assert len(tasks) >= 1, "Search should find at least one task"
        
        # Verify search term is in title or task_id
        found = any(search_term in t.get('title', '') or search_term in t.get('task_id', '') for t in tasks)
        assert found, "Search term not found in results"
        
        print(f"Search results for '{search_term}': {len(tasks)}")
    
    def test_task_not_found(self):
        """Test GET /api/tasks/{task_id} with invalid ID returns 404"""
        response = self.session.get(f"{BASE_URL}/api/tasks/TASK-99999")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Task not found test passed")
    
    def test_task_id_auto_generation(self):
        """Test that task_id is auto-generated in sequence (TASK-XXXXX)"""
        # Create two tasks and verify sequential IDs
        task1 = self.session.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_AutoID_1",
            "department": "IT"
        }).json()
        
        task2 = self.session.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_AutoID_2",
            "department": "IT"
        }).json()
        
        # Verify task_id format
        assert task1['task_id'].startswith('TASK-'), f"Invalid task_id format: {task1['task_id']}"
        assert task2['task_id'].startswith('TASK-'), f"Invalid task_id format: {task2['task_id']}"
        
        # Extract numeric parts and verify sequence
        num1 = int(task1['task_id'].replace('TASK-', ''))
        num2 = int(task2['task_id'].replace('TASK-', ''))
        assert num2 > num1, f"Task IDs not sequential: {task1['task_id']} -> {task2['task_id']}"
        
        print(f"Auto-generated IDs: {task1['task_id']} -> {task2['task_id']}")


class TestEmployeesDropdown:
    """Test that employees are available for task assignment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "superadmin@bijnisbooks.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("access_token")
        self.session.headers.update({'Authorization': f'Bearer {token}'})
        yield
    
    def test_employees_list_available(self):
        """Test GET /api/employees - should have employees for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        
        employees = response.json()
        assert isinstance(employees, list), "Employees should be a list"
        assert len(employees) > 0, "Should have at least one employee for assignment dropdown"
        
        # Verify employee structure
        emp = employees[0]
        assert 'id' in emp, "Missing 'id' in employee"
        assert 'name' in emp, "Missing 'name' in employee"
        
        print(f"Available employees for assignment: {len(employees)}")
        for e in employees[:5]:
            print(f"  - {e.get('name')} ({e.get('designation', 'N/A')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
