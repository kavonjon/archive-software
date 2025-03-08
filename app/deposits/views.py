from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Deposit, DepositFile
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .metadata import MetadataProcessor
from api.v1.serializers.deposits import DepositFileSerializer

@login_required
def deposit_list(request):
    """View for listing all deposits accessible to the user"""
    # Get deposits the user has access to
    if request.user.has_perm('deposits.can_manage_deposits'):
        deposits = Deposit.objects.all()
    else:
        deposits = Deposit.objects.filter(
            Q(draft_user=request.user) | 
            Q(involved_users=request.user)
        ).distinct()
    
    return render(request, 'deposits/deposit_list.html', {'deposits': deposits})

@login_required
def deposit_detail(request, deposit_id):
    """View for showing deposit details"""
    deposit = get_object_or_404(Deposit, id=deposit_id)
    
    # Check if user has access to this deposit
    if not request.user.has_perm('deposits.can_manage_deposits') and \
       request.user != deposit.draft_user and \
       request.user not in deposit.involved_users.all():
        return redirect('deposit_list')
    
    return render(request, 'deposits/deposit_detail.html', {'deposit': deposit})

@login_required
def deposit_create(request):
    """View for creating a new deposit"""
    # Handle form submission
    if request.method == 'POST':
        # Process form data
        # Redirect to the new deposit
        pass
    
    # Initialize metadata with a draft version
    initial_metadata = {
        'format': 'archive_deposit_json_v0.1',
        'deposit_id': str(deposit.id),
        'versions': [{
            'version': 1,
            'state': 'DRAFT',
            'timestamp': timezone.now().isoformat(),
            'modified_by': request.user.username,
            'is_draft': True,  # Mark as draft
            'comment': 'Initial deposit',
            'data': {}
        }]
    }
    
    deposit.metadata = initial_metadata
    deposit.save()
    
    return render(request, 'deposits/deposit_form.html')

@login_required
def deposit_edit(request, deposit_id):
    """View for editing an existing deposit"""
    deposit = get_object_or_404(Deposit, id=deposit_id)
    
    # Check if user has permission to edit
    if not request.user.has_perm('deposits.can_manage_deposits') and \
       request.user != deposit.draft_user:
        return redirect('deposit_list')
    
    # Handle form submission
    if request.method == 'POST':
        # Process form data
        # Redirect to the deposit detail page
        pass
    
    return render(request, 'deposits/deposit_form.html', {'deposit': deposit})

@login_required
def deposit_files(request, deposit_id):
    """View for managing files for a deposit"""
    deposit = get_object_or_404(Deposit, id=deposit_id)
    
    # Check if user has access to this deposit
    if not request.user.has_perm('deposits.can_manage_deposits') and \
       request.user != deposit.draft_user and \
       request.user not in deposit.involved_users.all():
        return redirect('deposit_list')
    
    files = deposit.files.all()
    
    return render(request, 'deposits/deposit_files.html', {
        'deposit': deposit,
        'files': files
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_files(request, deposit_id):
    print(f"Upload request received for deposit {deposit_id}")
    print(f"User: {request.user}, authenticated: {request.user.is_authenticated}")
    print(f"Request method: {request.method}")
    print(f"Request FILES: {request.FILES}")
    
    try:
        deposit = Deposit.objects.get(id=deposit_id)
        print(f"Found deposit: {deposit.id}, state: {deposit.state}")
        
        # Check if user has permission to upload files
        can_edit = deposit.can_edit(request.user)
        print(f"User {request.user.username} can edit deposit: {can_edit}")
        print(f"User groups: {[g.name for g in request.user.groups.all()]}")
        
        if not can_edit:
            print(f"Permission denied for user {request.user.username} to upload to deposit {deposit_id}")
            return Response(
                {"error": "You don't have permission to upload files to this deposit"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Process the file upload
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create the deposit file
        deposit_file = DepositFile.objects.create(
            deposit=deposit,
            file=file_obj,
            filename=file_obj.name,
            filesize=file_obj.size,
            uploaded_by=request.user
        )
        
        return Response(DepositFileSerializer(deposit_file).data)
        
    except Deposit.DoesNotExist:
        return Response(
            {"error": "Deposit not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 