"""
URL configuration for Work Orders app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import WorkOrderViewSet, WorkOrderCommentViewSet, WorkOrderPartViewSet


router = DefaultRouter()
router.register(r'', WorkOrderViewSet, basename='workorder')
router.register(r'comments', WorkOrderCommentViewSet, basename='workordercomment')
router.register(r'parts', WorkOrderPartViewSet, basename='workorderpart')

urlpatterns = [
    path('', include(router.urls)),
]
