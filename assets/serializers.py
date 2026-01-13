"""
Serializers for Assets app
"""
from rest_framework import serializers
from .models import Asset, AssetStatus


class AssetSerializer(serializers.ModelSerializer):
    """Serializer for Asset model"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    equipment_name = serializers.CharField(source='name', read_only=True)
    location_display = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    level = serializers.IntegerField(read_only=True)

    class Meta:
        model = Asset
        fields = ['id', 'code', 'name', 'process', 'equipment_id', 'machine_name',
                  'location_path', 'factory', 'workshop', 'line', 'station',
                  'vendor', 'model', 'serial_number', 'specification',
                  'start_date', 'warranty_expiry', 'status', 'status_display',
                  'parent', 'criticality', 'cost_center', 'asset_value',
                  'expected_life_years', 'current_meter_reading', 'meter_unit',
                  'last_maintenance_date', 'next_maintenance_date',
                  'notes', 'created_by', 'created_at', 'updated_at',
                  'equipment_name', 'location_display', 'is_overdue', 'level']
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_overdue', 'level', 'created_by']

    def get_location_display(self, obj):
        """Get full location display"""
        return obj.get_full_location()

    def validate(self, attrs):
        """Custom validation"""
        # Validate parent is not self
        if 'parent' in attrs and attrs.get('parent'):
            if attrs['parent'].id == self.instance.id if self.instance else None:
                raise serializers.ValidationError({"parent": "An asset cannot be its own parent"})
        return attrs


class AssetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for asset lists"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_display = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Asset
        fields = ['id', 'code', 'name', 'factory', 'workshop', 'line', 'station',
                  'status', 'status_display', 'criticality', 'location_display', 'is_overdue']

    def get_location_display(self, obj):
        """Get full location display"""
        return obj.get_full_location()


class AssetTreeSerializer(serializers.ModelSerializer):
    """Serializer for asset hierarchy tree"""
    children = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Asset
        fields = ['id', 'code', 'name', 'status', 'status_display', 'children']

    def get_children(self, obj):
        """Get child assets"""
        children = obj.children.filter(status=AssetStatus.ACTIVE)
        return AssetTreeSerializer(children, many=True).data
