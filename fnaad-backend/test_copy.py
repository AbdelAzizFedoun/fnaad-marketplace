from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from catalog.models import Product
import io
from PIL import Image

User = get_user_model()
User.objects.filter(username__startswith='tt_').delete()
client = APIClient()

a1 = User.objects.create_user('tt_a1','tt_a1@test.com','pass', role=User.ROLE_ARTIST)
a2 = User.objects.create_user('tt_a2','tt_a2@test.com','pass', role=User.ROLE_ARTIST)
sa = User.objects.create_superuser('tt_admin','tt_admin@test.com','pass')

buf = io.BytesIO()
Image.new('RGB',(30,30),color='red').save(buf,format='PNG')
img = buf.getvalue()

client.force_authenticate(user=a1)
r = client.post('/api/products/create/', {'title':'P1','description':'d','price_xaf':1000,'category':'painting'})
pid1 = r.data['id']
buf = io.BytesIO(img)
r = client.post(f'/api/products/{pid1}/images/', {'is_primary':True,'order':0}, format='multipart')

client.force_authenticate(user=sa)
r = client.patch(f'/api/products/{pid1}/approve/', {'status':'approved'}, format='json')

client.force_authenticate(user=a2)
r = client.post('/api/products/create/', {'title':'P2','description':'d','price_xaf':1000,'category':'painting'})
pid2 = r.data['id']
buf = io.BytesIO(img)
r = client.post(f'/api/products/{pid2}/images/', {'is_primary':True,'order':0}, format='multipart')

p2 = Product.objects.get(id=pid2)
assert p2.status=='rejected' and p2.flagged_as_copy and p2.copy_of_id==pid1
print('OK')
