"""
Pytest configuration and fixtures
"""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from assets.models import Asset
from workorders.models import WorkOrder, WorkOrderStatus, WorkOrderType

User = get_user_model()


@pytest.fixture
def api_client():
    """API client fixture"""
    return APIClient()


@pytest.fixture
def admin_user(db):
    """Create admin user fixture"""
    return User.objects.create_user(
        username='admin',
        password='admin123',
        email='admin@test.com',
        full_name='Admin User',
        role='admin'
    )


@pytest.fixture
def supervisor_user(db):
    """Create supervisor user fixture"""
    return User.objects.create_user(
        username='supervisor',
        password='supervisor123',
        email='supervisor@test.com',
        full_name='Supervisor User',
        role='supervisor'
    )


@pytest.fixture
def technician_user(db):
    """Create technician user fixture"""
    return User.objects.create_user(
        username='technician',
        password='technician123',
        email='technician@test.com',
        full_name='Technician User',
        role='technician'
    )


@pytest.fixture
def authenticated_client(api_client, admin_user):
    """Authenticated API client fixture"""
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def asset(db, admin_user):
    """Create test asset fixture"""
    return Asset.objects.create(
        code='AST-001',
        name='Test Equipment',
        process='Assembly',
        factory='Factory A',
        workshop='Workshop 1',
        line='Line 1',
        station='Station 1',
        status='active',
        created_by=admin_user
    )


@pytest.fixture
def work_order(db, asset, admin_user):
    """Create test work order fixture"""
    return WorkOrder.objects.create(
        wo_code='WO-2024-0001',
        equipment=asset,
        wo_type=WorkOrderType.CM,
        status=WorkOrderStatus.OPEN,
        summary='Test work order',
        description='This is a test work order',
        priority='medium',
        requested_by=admin_user
    )
