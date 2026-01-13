"""
Tests for Work Orders functionality
"""
import pytest
from rest_framework import status
from django.utils import timezone
from workorders.models import WorkOrder, WorkOrderStatus, WorkOrderType


@pytest.mark.django_db
class TestWorkOrderAPI:
    """Test work order API endpoints"""

    def test_create_work_order(self, authenticated_client, asset, admin_user):
        """Test creating a new work order"""
        url = '/api/workorders/'
        data = {
            'wo_code': 'WO-2024-0002',
            'equipment': asset.id,
            'wo_type': 'CM',
            'summary': 'New work order',
            'description': 'Test description',
            'priority': 'high',
            'requested_by': admin_user.id
        }
        response = authenticated_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert WorkOrder.objects.filter(wo_code='WO-2024-0002').exists()

    def test_list_work_orders(self, authenticated_client, work_order):
        """Test listing work orders"""
        url = '/api/workorders/'
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1

    def test_get_work_order_detail(self, authenticated_client, work_order):
        """Test getting work order detail"""
        url = f'/api/workorders/{work_order.id}/'
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['wo_code'] == work_order.wo_code

    def test_assign_work_order(self, authenticated_client, work_order, technician_user):
        """Test assigning a work order"""
        url = f'/api/workorders/{work_order.id}/assign/'
        data = {'assignee_id': technician_user.id}
        response = authenticated_client.post(url, data, format='json')
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.ASSIGNED
        assert work_order.assignee == technician_user

    def test_start_work_order(self, authenticated_client, work_order):
        """Test starting a work order"""
        # First assign it
        work_order.status = WorkOrderStatus.ASSIGNED
        work_order.save()

        url = f'/api/workorders/{work_order.id}/start/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.IN_PROGRESS
        assert work_order.actual_start is not None

    def test_complete_work_order(self, authenticated_client, work_order):
        """Test completing a work order"""
        # Setup: work order in progress
        work_order.status = WorkOrderStatus.IN_PROGRESS
        work_order.actual_start = timezone.now()
        work_order.save()

        url = f'/api/workorders/{work_order.id}/complete/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST  # No actions_taken

        # Add actions_taken
        work_order.actions_taken = 'Replaced faulty component'
        work_order.save()
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.COMPLETED

    def test_close_work_order(self, authenticated_client, work_order):
        """Test closing a work order"""
        # Setup: completed work order
        work_order.status = WorkOrderStatus.COMPLETED
        work_order.actual_end = timezone.now()
        work_order.completed_at = timezone.now()
        work_order.actions_taken = 'Fixed the issue'
        work_order.save()

        url = f'/api/workorders/{work_order.id}/close/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.CLOSED

    def test_my_orders_filter(self, authenticated_client, work_order, technician_user):
        """Test getting my assigned orders"""
        # Assign work order to technician
        work_order.assignee = technician_user
        work_order.status = WorkOrderStatus.ASSIGNED
        work_order.save()

        # Authenticate as technician
        authenticated_client.force_authenticate(user=technician_user)
        url = '/api/workorders/my_orders/'
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_status(self, authenticated_client, work_order):
        """Test filtering work orders by status"""
        url = '/api/workorders/?status=open'
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert all(wo['status'] == 'open' for wo in response.data['results'])


@pytest.mark.django_db
class TestWorkOrderWorkflow:
    """Test complete work order lifecycle"""

    def test_full_lifecycle(self, authenticated_client, work_order, technician_user):
        """Test complete workflow: open -> assigned -> in_progress -> completed -> closed"""
        # Step 1: Assign
        url = f'/api/workorders/{work_order.id}/assign/'
        response = authenticated_client.post(url, {'assignee_id': technician_user.id})
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.ASSIGNED

        # Step 2: Start
        url = f'/api/workorders/{work_order.id}/start/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.IN_PROGRESS

        # Step 3: Complete
        work_order.actions_taken = 'Replaced broken part'
        work_order.save()
        url = f'/api/workorders/{work_order.id}/complete/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.COMPLETED

        # Step 4: Close
        url = f'/api/workorders/{work_order.id}/close/'
        response = authenticated_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        work_order.refresh_from_db()
        assert work_order.status == WorkOrderStatus.CLOSED
