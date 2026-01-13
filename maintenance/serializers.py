"""
Serializers for Maintenance app
"""
from rest_framework import serializers
from .models import MaintenancePlan, WorkOrderTemplate, TriggerType


class MaintenancePlanSerializer(serializers.ModelSerializer):
    """Serializer for MaintenancePlan model"""
    equipment_code = serializers.CharField(source='equipment.code', read_only=True)
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    frequency_unit_display = serializers.CharField(source='get_frequency_unit_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = MaintenancePlan
        fields = [
            'id', 'code', 'equipment', 'equipment_code', 'equipment_name',
            'title', 'description', 'trigger_type', 'trigger_type_display',
            'frequency_value', 'frequency_unit', 'frequency_unit_display',
            'counter_name', 'counter_threshold',
            'checklist_template', 'estimated_hours', 'estimated_cost',
            'required_skills', 'priority', 'is_active',
            'last_generated_date', 'last_counter_value',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class MaintenancePlanListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for maintenance plan lists"""
    equipment_code = serializers.CharField(source='equipment.code', read_only=True)
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    frequency_display = serializers.SerializerMethodField()

    class Meta:
        model = MaintenancePlan
        fields = [
            'id', 'code', 'equipment_code', 'equipment_name', 'title',
            'trigger_type', 'trigger_type_display', 'frequency_display',
            'priority', 'is_active', 'last_generated_date'
        ]

    def get_frequency_display(self, obj):
        """Get human-readable frequency display"""
        if obj.trigger_type == TriggerType.TIME and obj.frequency_value:
            return f"{obj.frequency_value} {obj.get_frequency_unit_display()}"
        elif obj.trigger_type == TriggerType.COUNTER and obj.counter_threshold:
            return f"{obj.counter_name or 'Counter'} >= {obj.counter_threshold}"
        return "-"


class WorkOrderTemplateSerializer(serializers.ModelSerializer):
    """Serializer for WorkOrderTemplate model"""
    work_order_type_display = serializers.CharField(source='get_work_order_type_display', read_only=True)

    class Meta:
        model = WorkOrderTemplate
        fields = [
            'id', 'code', 'name', 'description', 'work_order_type',
            'work_order_type_display', 'checklist_template',
            'estimated_hours', 'required_skills', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
